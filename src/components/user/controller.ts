import type { FastifyReply, FastifyRequest } from "fastify";
import { USER_COLLECTION } from "../../constants/collectionNames.ts";
import { AppError } from "../utils/AppError.ts";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../constants/constants.ts";
import { ObjectId } from "@fastify/mongodb";

export const getMyDetails = async (
	req: FastifyRequest,
	reply: FastifyReply,
) => {
	const db = req.server.mongo.db;
	const { _id } = req.user || {};

	if (!_id) {
		throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
	}

	const user = await db
		?.collection(USER_COLLECTION)
		.findOne({ _id: new ObjectId(_id) }, { projection: { password: 0 } });

	if (!user) {
		throw new AppError(
			"User not found",
			HTTP_STATUS.NOT_FOUND,
			ERROR_CODES.USER_NOT_FOUND,
		);
	}

	return reply.status(HTTP_STATUS.OK).send({
		status: true,
		data: user,
		statusCode: HTTP_STATUS.OK,
		error: null,
	});
};
