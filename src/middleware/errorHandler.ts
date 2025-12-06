import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../components/utils/AppError.ts";
import { HTTP_STATUS } from "../constants/HTTP_STATUS.ts";

const sendValidationError = (err: FastifyError, reply: FastifyReply) => {
  return reply.status(HTTP_STATUS.BAD_REQUEST).send({
    status: false,
    error: err.message || "Invalid request data",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    code: err.code,
    data: null,
  });
};

const sendInternalServerErrors = (err: FastifyError, reply: FastifyReply) => {
  return reply.status(500).send({
    status: false,
    error: err.message || "Internal Server Error",
    statusCode: 500,
    code: err.code,
    data: null,
  });
};

export const errorHandler = async (
  error: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply
) => {

  if (error instanceof AppError) {
    req.log.error(error, "Request error 💥");

    reply.status(error.statusCode).send({
      status: error.status,
      error: error.message,
      statusCode: error.statusCode,
      code: error.code,
      data: null,
    });
  } else {
    req.log.error({ err: error, req }, "Request error 💥");

    if (error.code === "FST_ERR_VALIDATION")
      return sendValidationError(error, reply);

    return sendInternalServerErrors(error, reply);
  }
};
