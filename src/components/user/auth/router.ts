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
  SignInSchema,
  type SignInPayloadT,
  type SignUpUserPayloadType,
} from "./schema.ts";

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
};
