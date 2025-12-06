import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authRouter } from "./auth/router.ts";
import { catchHandler } from "../utils/catchHandler.ts";
import { getMyDetails } from "./controller.ts";
import { verifyToken } from "../../middleware/auth.ts";

export const userRouter = (
	fastify: FastifyInstance,
	_opts: FastifyPluginOptions,
) => {
	fastify.register(authRouter, { prefix: "auth" });

	fastify.get(
		"/profile",
		{
			preHandler: [verifyToken],
		},
		catchHandler(getMyDetails),
	);
};
