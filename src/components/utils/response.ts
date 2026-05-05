import type { FastifyReply } from "fastify";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";

/**
 * Unified response helpers — every controller uses these so the
 * shape is always { status, statusCode, data, error }.
 */
export const sendSuccess = <T>(
  reply: FastifyReply,
  data: T,
  statusCode: number = HTTP_STATUS.OK,
) => {
  return reply.status(statusCode).send({
    status: true,
    statusCode,
    data,
    error: null,
  });
};

export const sendError = (
  reply: FastifyReply,
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
) => {
  return reply.status(statusCode).send({
    status: false,
    statusCode,
    data: null,
    error: message,
  });
};
