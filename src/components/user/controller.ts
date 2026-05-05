import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../utils/AppError.ts";
import { sendSuccess } from "../utils/response.ts";
import { HTTP_STATUS } from "../../constants/HTTP_STATUS.ts";
import { ERROR_CODES } from "../../constants/constants.ts";
import prisma from "../../lib/prisma.ts";

// ─── Get Project Members ──────────────────────────────────────────────────────
// Returns all users who are members of the same project as the logged-in user.
// Used for the "Assign To" dropdown in task forms.
export const getProjectMembers = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  const { _id } = req.user || {};

  if (!_id) {
    throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
  }

  // Find the project the current user belongs to
  const projectLink = await prisma.projectUserLink.findFirst({
    where: { userId: _id },
    select: { projectId: true },
  });

  if (!projectLink) {
    // User has no project yet — return just themselves
    const self = await prisma.user.findUnique({
      where: { id: _id },
      select: { id: true, name: true, username: true, email: true, profileImageId: true },
    });
    return sendSuccess(reply, self ? [self] : []);
  }

  // Return all members of that project
  const members = await prisma.projectUserLink.findMany({
    where: { projectId: projectLink.projectId },
    include: {
      user: {
        select: { id: true, name: true, username: true, email: true, profileImageId: true },
      },
    },
  });

  return sendSuccess(reply, members.map((m) => m.user));
};

// ─── Get My Details ───────────────────────────────────────────────────────────
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
