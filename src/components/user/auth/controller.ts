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

  const token = genLoginToken({ _id: user.id }, { expiresIn: "7d" });
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
