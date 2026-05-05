import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { catchHandler } from "../../utils/catchHandler.ts";
import {
  checkUser,
  forgotPassword,
  resendOtp,
  resetPassword,
  signin,
  signup,
  suggestUserNames,
  verifyOtp,
} from "./controller.ts";
import {
  passkeyDelete,
  passkeyList,
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyRename,
} from "./passkeyController.ts";
import {
  SignInSchema,
  type SignInPayloadT,
  type SignUpUserPayloadType,
} from "./schema.ts";
import { verifyToken } from "../../../middleware/auth.ts";

export const authRouter = (
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) => {
  fastify.post("/check", catchHandler(checkUser));

  fastify.post<{ Body: SignUpUserPayloadType }>(
    "/signup",
    catchHandler(signup)
  );

  fastify.get<{ Querystring: { name: string } }>(
    "/suggest-usernames",
    catchHandler(suggestUserNames)
  );

  fastify.post<{ Body: { email: string } }>(
    "/otp/resend",
    catchHandler(resendOtp)
  );

  fastify.post<{ Body: { email: string; otp: string } }>(
    "/otp/verify",
    catchHandler(verifyOtp)
  );

  fastify.post<{ Body: SignInPayloadT }>(
    "/signin",
    {
      schema: {
        body: SignInSchema,
      },
    },
    catchHandler(signin)
  );

  // ─── Password Reset ──────────────────────────────────────────────────────
  fastify.post<{ Body: { email: string } }>(
    "/forgot-password",
    catchHandler(forgotPassword)
  );

  fastify.post<{ Body: { email: string; token: string; newPassword: string } }>(
    "/reset-password",
    catchHandler(resetPassword)
  );

  // ─── Passkey (WebAuthn) ───────────────────────────────────────────────────
  // Registration (requires auth — user must be logged in to add a passkey)
  fastify.get(
    "/passkey/register/options",
    { preHandler: [verifyToken] },
    catchHandler(passkeyRegisterOptions)
  );

  fastify.post<{ Body: { credential: Record<string, unknown>; deviceName?: string } }>(
    "/passkey/register/verify",
    { preHandler: [verifyToken] },
    catchHandler(passkeyRegisterVerify)
  );

  // Authentication (public — user is not logged in yet)
  fastify.post<{ Body: { email: string } }>(
    "/passkey/login/options",
    catchHandler(passkeyLoginOptions)
  );

  fastify.post<{ Body: { email: string; credential: Record<string, unknown> } }>(
    "/passkey/login/verify",
    catchHandler(passkeyLoginVerify)
  );

  // Manage passkeys (requires auth)
  fastify.get(
    "/passkey",
    { preHandler: [verifyToken] },
    catchHandler(passkeyList)
  );

  fastify.patch<{ Params: { id: string }; Body: { deviceName: string } }>(
    "/passkey/:id",
    { preHandler: [verifyToken] },
    catchHandler(passkeyRename)
  );

  fastify.delete<{ Params: { id: string } }>(
    "/passkey/:id",
    { preHandler: [verifyToken] },
    catchHandler(passkeyDelete)
  );
};
