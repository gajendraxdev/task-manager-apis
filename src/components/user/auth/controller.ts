import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../utils/AppError.ts";
import { sendSuccess } from "../../utils/response.ts";
import { HTTP_STATUS } from "../../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../../constants/constants.ts";
import { CACHE_KEYS } from "../../../constants/cacheKeys.ts";
import { filterData } from "../../utils/filterData.ts";
import { generateUniqueSlug } from "../../utils/uniqueSlug.ts";
import type { SignInPayloadT, SignUpUserPayloadType } from "./schema.ts";
import { OrgPermissions, OrgRoles } from "../orgUserLink/schema.ts";
import { sendOtp } from "../../utils/otp.ts";
import { delCache, getCache, setCache } from "../../../lib/node-cache.ts";
import { genLoginToken } from "../../../lib/jwt.ts";
import { compareHashAndData, hashString } from "../../../lib/bcrypt.ts";
import { UserSignedUpWith } from "../schema.ts";
import { generateUsernames } from "../../utils/userNameSuggetions.ts";
import { APP_URL, NODE_MAILER_SENDER_EMAIL } from "../../../constants/env.ts";
import { generateRandomString } from "../../utils/genRendomString.ts";
import { sendNotification } from "../../utils/notification.ts";
import prisma from "../../../lib/prisma.ts";
import type { Prisma } from "../../../generated/prisma/client.js";

// ─── Sign Up ──────────────────────────────────────────────────────────────────
export const signup = async (
  req: FastifyRequest<{ Body: SignUpUserPayloadType }>,
  reply: FastifyReply,
) => {
  const { body } = req;

  const userFields = filterData.addFields(body.user, [
    "name",
    "username",
    "email",
    "password",
    "profileImageId",
  ]) as {
    name: string;
    username: string;
    email: string;
    password: string;
    profileImageId?: string;
  };

  const existingUser = await prisma.user.findUnique({
    where: { email: userFields.email },
  });

  if (existingUser) {
    throw new AppError(
      "You are already registered on TaskFlow, please login!",
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  const hashedPassword = await hashString(userFields.password);

  const orgSlug = await generateUniqueSlug(
    body.organization.name,
    async (slug) => !!(await prisma.organization.findUnique({ where: { slug } })),
  );

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        name: userFields.name,
        username: userFields.username,
        email: userFields.email,
        password: hashedPassword,
        profileImageId: userFields.profileImageId,
        userSignedUpWith: UserSignedUpWith.EMAIL,
        isEmailVerified: false,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: body.organization.name,
        slug: orgSlug,
        description: body.organization.description,
        ownerId: user.id,
      },
    });

    await tx.orgUserLink.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: OrgRoles.owner as any,
        permissions: Object.values(OrgPermissions) as any[],
      },
    });

    if (body.project && Object.keys(body.project).length > 0) {
      const projectSlug = await generateUniqueSlug(
        body.project.name,
        async (slug) => !!(await tx.project.findUnique({ where: { slug } })),
      );

      await tx.project.create({
        data: {
          name: body.project.name,
          slug: projectSlug,
          description: body.project.description,
          organizationId: organization.id,
          createdById: user.id,
        },
      });
    }

    return user;
  });

  await sendOtp(result.email, result.name);

  return sendSuccess(
    reply,
    { message: "To complete registration, verify the code sent to your email." },
    HTTP_STATUS.CREATED,
  );
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
export const resendOtp = async (
  req: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Please login again", HTTP_STATUS.UNAUTHORIZED);
  }

  await sendOtp(email, user.name);

  return sendSuccess(reply, { message: "OTP resent successfully." });
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOtp = async (
  req: FastifyRequest<{ Body: { email: string; otp: string } }>,
  reply: FastifyReply,
) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError("Something went wrong! Please login again.", HTTP_STATUS.FORBIDDEN);
  }

  const cached = getCache<{ otp: string }>(CACHE_KEYS.OTP(email));
  if (!cached) {
    throw new AppError("OTP expired. Please login again.", HTTP_STATUS.UNAUTHORIZED);
  }

  if (cached.otp !== otp) {
    throw new AppError("Invalid OTP", HTTP_STATUS.FORBIDDEN, ERROR_CODES.INVALID_OTP);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Something went wrong, please login again!", HTTP_STATUS.FORBIDDEN);
  }

  const token = genLoginToken({ _id: user.id });
  delCache(CACHE_KEYS.OTP(email));

  await prisma.user.update({
    where: { email },
    data: { isEmailVerified: true },
  });

  return sendSuccess(reply, { message: "OTP verified successfully.", token });
};

// ─── Check User ───────────────────────────────────────────────────────────────
export const checkUser = async (
  req: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, email: true, userSignedUpWith: true },
  });

  if (!user) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
  }

  return sendSuccess(reply, user);
};

// ─── Sign In ──────────────────────────────────────────────────────────────────
export const signin = async (
  req: FastifyRequest<{ Body: SignInPayloadT }>,
  reply: FastifyReply,
) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
  }

  const isPasswordValid = await compareHashAndData(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
  }

  await sendOtp(email, user.name);

  return sendSuccess(reply, { message: "OTP sent to your registered email." });
};

// ─── Suggest Usernames ────────────────────────────────────────────────────────
export const suggestUserNames = async (
  req: FastifyRequest<{ Querystring: { name: string } }>,
  reply: FastifyReply,
) => {
  const { name } = req.query;

  const generated = generateUsernames(name);

  const existing = await prisma.user.findMany({
    where: { username: { in: generated } },
    select: { username: true },
  });

  const takenSet = new Set(existing.map((u: { username: string }) => u.username));
  const available = generated.filter((u) => !takenSet.has(u));

  return sendSuccess(reply, { suggestions: available });
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const forgotPassword = async (
  req: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success — never reveal whether the email exists
  const genericResponse = { message: "If that email exists, a reset link has been sent." };

  if (!user) {
    return sendSuccess(reply, genericResponse);
  }

  const rawToken = generateRandomString(32, { alphabets: true, numbers: true });
  const hashedToken = await hashString(rawToken);

  setCache({
    key: CACHE_KEYS.PASSWORD_RESET(email),
    value: { hashedToken },
    ttl: 900, // 15 minutes
  });

  const resetLink = `${APP_URL}/set-new-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

  const notifResp = await sendNotification("reset-password", {
    from: NODE_MAILER_SENDER_EMAIL,
    to: email,
    subject: "TaskFlow — Reset Your Password",
    variables: { userName: user.name, resetLink },
  });

  if (notifResp.error) {
    throw new AppError("Failed to send reset email. Please try again.");
  }

  return sendSuccess(reply, genericResponse);
};

// ─── Reset Password ───────────────────────────────────────────────────────────
export const resetPassword = async (
  req: FastifyRequest<{ Body: { email: string; token: string; newPassword: string } }>,
  reply: FastifyReply,
) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    throw new AppError("Invalid request", HTTP_STATUS.BAD_REQUEST);
  }

  const cached = getCache<{ hashedToken: string }>(CACHE_KEYS.PASSWORD_RESET(email));

  if (!cached) {
    throw new AppError(
      "Reset link has expired. Please request a new one.",
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.EXPIRED_TOKEN,
    );
  }

  const isValid = await compareHashAndData(token, cached.hashedToken);

  if (!isValid) {
    throw new AppError(
      "Invalid or expired reset link.",
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.INVALID_TOKEN,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("User not found.", HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
  }

  await prisma.user.update({
    where: { email },
    data: { password: await hashString(newPassword) },
  });

  delCache(CACHE_KEYS.PASSWORD_RESET(email));

  return sendSuccess(reply, { message: "Password reset successfully. You can now log in." });
};

// ─── Passkey: Registration Options ───────────────────────────────────────────
export const passkeyRegisterOptions = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { _id } = req.user!;

  const user = await prisma.user.findUnique({
    where: { id: _id },
    select: { id: true, email: true, name: true, username: true },
  });
  if (!user) throw new AppError("User not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);

  const existingCredentials = await prisma.webAuthnCredential.findMany({
    where: { userId: _id },
    select: { credentialId: true },
  });

  const { generateRegistrationOptions } = await import("@simplewebauthn/server");

  const options = await generateRegistrationOptions({
    rpName: "TaskFlow",
    rpID: new URL(APP_URL).hostname,
    userName: user.username,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialId,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Cache challenge for 5 minutes
  setCache({ key: CACHE_KEYS.PASSKEY_REG_CHALLENGE(_id), value: { challenge: options.challenge }, ttl: 300 });

  return sendSuccess(reply, options);
};

// ─── Passkey: Registration Verify ────────────────────────────────────────────
export const passkeyRegisterVerify = async (
  req: FastifyRequest<{ Body: { credential: Record<string, unknown>; deviceName?: string } }>,
  reply: FastifyReply,
) => {
  const { _id } = req.user!;
  const { credential, deviceName } = req.body;

  const cached = getCache<{ challenge: string }>(CACHE_KEYS.PASSKEY_REG_CHALLENGE(_id));
  if (!cached) throw new AppError("Challenge expired, please try again.", HTTP_STATUS.BAD_REQUEST);

  const { verifyRegistrationResponse } = await import("@simplewebauthn/server");

  const verification = await verifyRegistrationResponse({
    response: credential as any,
    expectedChallenge: cached.challenge,
    expectedOrigin: APP_URL,
    expectedRPID: new URL(APP_URL).hostname,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError("Passkey verification failed.", HTTP_STATUS.BAD_REQUEST, ERROR_CODES.PASSKEY_VERIFICATION_FAILED);
  }

  const { credential: cred } = verification.registrationInfo;

  await prisma.webAuthnCredential.create({
    data: {
      userId: _id,
      credentialId: cred.id,
      publicKey: Buffer.from(cred.publicKey).toString("base64"),
      counter: cred.counter,
      deviceName: deviceName || null,
    },
  });

  delCache(CACHE_KEYS.PASSKEY_REG_CHALLENGE(_id));

  return sendSuccess(reply, { message: "Passkey registered successfully." });
};

// ─── Passkey: Login Options ───────────────────────────────────────────────────
export const passkeyLoginOptions = async (
  req: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { webauthnCredentials: { select: { credentialId: true } } },
  });

  // Generic error — don't reveal whether the email exists
  if (!user || !user.webauthnCredentials.length) {
    throw new AppError("No passkeys found for this account.", HTTP_STATUS.BAD_REQUEST);
  }

  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

  const options = await generateAuthenticationOptions({
    rpID: new URL(APP_URL).hostname,
    userVerification: "preferred",
    allowCredentials: user.webauthnCredentials.map((c) => ({ id: c.credentialId })),
  });

  setCache({ key: CACHE_KEYS.PASSKEY_AUTH_CHALLENGE(email), value: { challenge: options.challenge }, ttl: 300 });

  return sendSuccess(reply, options);
};

// ─── Passkey: Login Verify ────────────────────────────────────────────────────
export const passkeyLoginVerify = async (
  req: FastifyRequest<{ Body: { email: string; credential: Record<string, unknown> } }>,
  reply: FastifyReply,
) => {
  const { email, credential } = req.body;

  const cached = getCache<{ challenge: string }>(CACHE_KEYS.PASSKEY_AUTH_CHALLENGE(email));
  if (!cached) throw new AppError("Challenge expired, please try again.", HTTP_STATUS.BAD_REQUEST);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { webauthnCredentials: true },
  });
  if (!user) throw new AppError("User not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);

  const credentialId = (credential as any).id as string;
  const storedCred = user.webauthnCredentials.find((c) => c.credentialId === credentialId);
  if (!storedCred) {
    throw new AppError("Passkey not found.", HTTP_STATUS.NOT_FOUND, ERROR_CODES.PASSKEY_NOT_FOUND);
  }

  const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");

  const verification = await verifyAuthenticationResponse({
    response: credential as any,
    expectedChallenge: cached.challenge,
    expectedOrigin: APP_URL,
    expectedRPID: new URL(APP_URL).hostname,
    credential: {
      id: storedCred.credentialId,
      publicKey: new Uint8Array(Buffer.from(storedCred.publicKey, "base64")),
      counter: storedCred.counter,
    },
  });

  if (!verification.verified) {
    // Delete challenge on failure to prevent retry attacks
    delCache(CACHE_KEYS.PASSKEY_AUTH_CHALLENGE(email));
    throw new AppError("Passkey verification failed.", HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.PASSKEY_VERIFICATION_FAILED);
  }

  // Update counter to prevent replay attacks
  await prisma.webAuthnCredential.update({
    where: { id: storedCred.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  delCache(CACHE_KEYS.PASSKEY_AUTH_CHALLENGE(email));

  const token = genLoginToken({ _id: user.id });

  return sendSuccess(reply, { token, message: "Signed in with passkey." });
};

// ─── Passkey: List ────────────────────────────────────────────────────────────
export const passkeyList = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { _id } = req.user!;

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId: _id },
    select: { id: true, deviceName: true, lastUsedAt: true },
    orderBy: { id: "desc" },
  });

  return sendSuccess(reply, credentials);
};

// ─── Passkey: Delete ──────────────────────────────────────────────────────────
export const passkeyDelete = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { _id } = req.user!;
  const { id } = req.params;

  const credential = await prisma.webAuthnCredential.findFirst({
    where: { id, userId: _id },
  });
  if (!credential) {
    throw new AppError("Passkey not found.", HTTP_STATUS.NOT_FOUND, ERROR_CODES.PASSKEY_NOT_FOUND);
  }

  await prisma.webAuthnCredential.delete({ where: { id } });

  return sendSuccess(reply, { message: "Passkey removed." });
};
