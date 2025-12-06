import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../components/utils/AppError.ts";
import { HTTP_STATUS } from "../constants/HTTP_STATUS.ts";
import { verifyJwt } from "../lib/jwt.ts";

declare module "fastify" {
	interface FastifyRequest {
		user?: {
			_id: string;
		};
	}
}

export const verifyToken = async (
	req: FastifyRequest,
	_reply: FastifyReply,
) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
	}

	const token = authHeader.split(" ")[1];

	const decoded = verifyJwt<{ _id: string }>(token);

	if (!decoded) {
		throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
	}

	req.user = decoded;
};
