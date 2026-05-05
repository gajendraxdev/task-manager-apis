/**
 * Passkey (WebAuthn) handlers — split from auth controller for modularity.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../utils/AppError.ts";
import { sendSuccess } from "../../utils/response.ts";
import { HTTP_STATUS } from "../../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../../constants/constants.ts";
import { CACHE_KEYS } from "../../../constants/cacheKeys.ts";
import { delCache, getCache, setCache } from "../../../lib/node-cache.ts";
import { genLoginToken } from "../../../lib/jwt.ts";
import { APP_URL } from "../../../constants/env.ts";
import prisma from "../../../lib/prisma.ts";

// ─── Registration Options ─────────────────────────────────────────────────────
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

  if (existingCredentials.length >= 10) {
    throw new AppError("Maximum of 10 passkeys allowed per account.", HTTP_STATUS.BAD_REQUEST);
  }

  const { generateRegistrationOptions } = await import("@simplewebauthn/server");

  const options = await generateRegistrationOptions({
    rpName: "TaskFlow",
    rpID: new URL(APP_URL).hostname,
    userName: user.username,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  setCache({ key: CACHE_KEYS.PASSKEY_REG_CHALLENGE(_id), value: { challenge: options.challenge }, ttl: 300 });

  return sendSuccess(reply, options);
};

// ─── Registration Verify ──────────────────────────────────────────────────────
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

// ─── Login Options ────────────────────────────────────────────────────────────
export const passkeyLoginOptions = async (
  req: FastifyRequest<{ Body: { email?: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

  if (!email) {
    const options = await generateAuthenticationOptions({
      rpID: new URL(APP_URL).hostname,
      userVerification: "preferred",
    });
    setCache({ key: CACHE_KEYS.PASSKEY_AUTH_CHALLENGE("__discoverable__"), value: { challenge: options.challenge }, ttl: 300 });
    return sendSuccess(reply, { ...options, discoverable: true });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { webauthnCredentials: { select: { credentialId: true } } },
  });

  if (!user || !user.webauthnCredentials.length) {
    throw new AppError("No passkeys found for this account.", HTTP_STATUS.BAD_REQUEST);
  }

  const options = await generateAuthenticationOptions({
    rpID: new URL(APP_URL).hostname,
    userVerification: "preferred",
    allowCredentials: user.webauthnCredentials.map((c) => ({ id: c.credentialId })),
  });

  setCache({ key: CACHE_KEYS.PASSKEY_AUTH_CHALLENGE(email), value: { challenge: options.challenge }, ttl: 300 });

  return sendSuccess(reply, options);
};

// ─── Login Verify ─────────────────────────────────────────────────────────────
export const passkeyLoginVerify = async (
  req: FastifyRequest<{ Body: { email?: string; credential: Record<string, unknown> } }>,
  reply: FastifyReply,
) => {
  const { email, credential } = req.body;
  const credentialId = (credential as any).id as string;

  const cacheKey = email
    ? CACHE_KEYS.PASSKEY_AUTH_CHALLENGE(email)
    : CACHE_KEYS.PASSKEY_AUTH_CHALLENGE("__discoverable__");

  const cached = getCache<{ challenge: string }>(cacheKey);
  if (!cached) throw new AppError("Challenge expired, please try again.", HTTP_STATUS.BAD_REQUEST);

  const storedCred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId },
    include: { user: true },
  });

  if (!storedCred) {
    delCache(cacheKey);
    throw new AppError("Passkey not found.", HTTP_STATUS.NOT_FOUND, ERROR_CODES.PASSKEY_NOT_FOUND);
  }

  if (email && storedCred.user.email !== email) {
    delCache(cacheKey);
    throw new AppError("Passkey verification failed.", HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.PASSKEY_VERIFICATION_FAILED);
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
    delCache(cacheKey);
    throw new AppError("Passkey verification failed.", HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.PASSKEY_VERIFICATION_FAILED);
  }

  await prisma.webAuthnCredential.update({
    where: { id: storedCred.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  delCache(cacheKey);

  const token = genLoginToken({ _id: storedCred.user.id }, { expiresIn: "7d" });

  return sendSuccess(reply, { token, message: "Signed in with passkey." });
};

// ─── List ─────────────────────────────────────────────────────────────────────
export const passkeyList = async (req: FastifyRequest, reply: FastifyReply) => {
  const { _id } = req.user!;

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId: _id },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return sendSuccess(reply, credentials);
};

// ─── Rename ───────────────────────────────────────────────────────────────────
export const passkeyRename = async (
  req: FastifyRequest<{ Params: { id: string }; Body: { deviceName: string } }>,
  reply: FastifyReply,
) => {
  const { _id } = req.user!;
  const { id } = req.params;
  const { deviceName } = req.body;

  const credential = await prisma.webAuthnCredential.findFirst({
    where: { id, userId: _id },
  });
  if (!credential) {
    throw new AppError("Passkey not found.", HTTP_STATUS.NOT_FOUND, ERROR_CODES.PASSKEY_NOT_FOUND);
  }

  const updated = await prisma.webAuthnCredential.update({
    where: { id },
    data: { deviceName: deviceName.trim() || null },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
  });

  return sendSuccess(reply, updated);
};

// ─── Delete ───────────────────────────────────────────────────────────────────
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
