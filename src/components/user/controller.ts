import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/AppError.ts";
import { sendSuccess } from "../utils/response.ts";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../constants/constants.ts";
import prisma from "../../lib/prisma.ts";

export const getMyDetails = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { _id } = req.user || {};

  if (!_id) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({
    where: { id: _id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      profileImageId: true,
      userSignedUpWith: true,
      isActive: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
  }

  return sendSuccess(reply, user);
};
