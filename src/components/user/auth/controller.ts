import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../utils/AppError.ts";
import { HTTP_STATUS } from "../../../constants/HTTP_STATUS.ts";
import { filterData } from "../../utils/filterData.ts";
import type { SignInPayloadT, SignUpUserPayloadType } from "./schema.ts";
import { OrgPermissions, OrgRoles } from "../orgUserLink/schema.ts";
import { sendOtp } from "../../utils/otp.ts";
import { delCache, getCache } from "../../../lib/node-cache.ts";
import { genLoginToken } from "../../../lib/jwt.ts";
import { compareHashAndData, hashString } from "../../../lib/bcrypt.ts";
import { UserSignedUpWith } from "../schema.ts";
import { generateUsernames } from "../../utils/userNameSuggetions.ts";
import { slugify } from "../../utils/slugify.ts";
import { ERROR_CODES } from "../../../constants/constants.ts";
import prisma from "../../../lib/prisma.ts";
import type { Prisma } from "../../../generated/prisma/client.js";

// ─── Sign Up ──────────────────────────────────────────────────────────────────
export const signup = async (
  req: FastifyRequest<{ Body: SignUpUserPayloadType }>,
  reply: FastifyReply,
) => {
  const { body } = req;

  const userFields = filterData.addFields(body.user, [
    "name",
    "username",
    "email",
    "password",
    "profileImageId",
  ]) as {
    name: string;
    username: string;
    email: string;
    password: string;
    profileImageId?: string;
  };

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: userFields.email },
  });

  if (existingUser) {
    throw new AppError(
      "You Are already registered on TaskFlow, Please login!",
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  const hashedPassword = await hashString(userFields.password);

  // Build org slug
  const orgName = body.organization.name;
  let orgSlug = slugify(orgName);
  const existingOrgSlug = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (existingOrgSlug) {
    orgSlug = `${orgSlug}-${Math.floor(Math.random() * 1000)}`;
  }

  // Run everything in a transaction
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create user
    const user = await tx.user.create({
      data: {
        name: userFields.name,
        username: userFields.username,
        email: userFields.email,
        password: hashedPassword,
        profileImageId: userFields.profileImageId,
        userSignedUpWith: UserSignedUpWith.EMAIL,
        isEmailVerified: false,
      },
    });

    // Create organization
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug: orgSlug,
        description: body.organization.description,
        ownerId: user.id,
      },
    });

    // Link user to org as owner with all permissions
    await tx.orgUserLink.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: OrgRoles.owner as any,
        permissions: Object.values(OrgPermissions) as any[],
      },
    });

    // Create project if provided
    if (body.project && Object.keys(body.project).length > 0) {
      let projectSlug = slugify(body.project.name);
      const existingProjectSlug = await tx.project.findUnique({
        where: { slug: projectSlug },
      });
      if (existingProjectSlug) {
        projectSlug = `${projectSlug}-${Math.floor(Math.random() * 1000)}`;
      }

      await tx.project.create({
        data: {
          name: body.project.name,
          slug: projectSlug,
          description: body.project.description,
          organizationId: organization.id,
          createdById: user.id,
        },
      });
    }

    return user;
  });

  await sendOtp(result.email, result.name);

  return reply.status(HTTP_STATUS.CREATED).send({
    status: true,
    statusCode: HTTP_STATUS.CREATED,
    error: null,
    data: {
      message:
        "To complete the registration we sent a mail to your registered email, please verify.",
    },
  });
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
export const resendOtp = async (
  req: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;

  const checkData = getCache(email);
  if (!checkData) {
    throw new AppError("Please login again", HTTP_STATUS.UNAUTHORIZED);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Please login again", HTTP_STATUS.UNAUTHORIZED);
  }

  await sendOtp(email, user.name);

  return reply.status(HTTP_STATUS.OK).send({
    status: true,
    statusCode: HTTP_STATUS.OK,
    error: null,
    data: { message: "OTP resent successfully." },
  });
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOtp = async (
  req: FastifyRequest<{ Body: { email: string; otp: string } }>,
  reply: FastifyReply,
) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError(
      "Something went wrong! Please login again.",
      HTTP_STATUS.FORBIDDEN,
    );
  }

  const cached = getCache(email) as { otp: string } | undefined;
  if (!cached) {
    throw new AppError("Please login again", HTTP_STATUS.UNAUTHORIZED);
  }

  if (cached.otp !== otp) {
    throw new AppError("Invalid OTP", HTTP_STATUS.FORBIDDEN);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(
      "Something went wrong, please login again!",
      HTTP_STATUS.FORBIDDEN,
    );
  }

  const token = genLoginToken({ _id: user.id });
  delCache(email);

  await prisma.user.update({
    where: { email },
    data: { isEmailVerified: true },
  });

  return reply.status(HTTP_STATUS.OK).send({
    status: true,
    statusCode: HTTP_STATUS.OK,
    error: null,
    data: {
      message: "OTP verified successfully.",
      token,
    },
  });
};

// ─── Check User ───────────────────────────────────────────────────────────────
export const checkUser = async (
  req: FastifyRequest<{ Body: { email: string } }>,
  reply: FastifyReply,
) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, email: true, userSignedUpWith: true },
  });

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

// ─── Sign In ──────────────────────────────────────────────────────────────────
export const signin = async (
  req: FastifyRequest<{ Body: SignInPayloadT }>,
  res: FastifyReply,
) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED);
  }

  const isPasswordValid = await compareHashAndData(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", HTTP_STATUS.UNAUTHORIZED);
  }

  await sendOtp(email, user.name);

  return res.status(HTTP_STATUS.OK).send({
    status: true,
    statusCode: HTTP_STATUS.OK,
    error: null,
    data: { message: "OTP sent to your registered email." },
  });
};

// ─── Suggest Usernames ────────────────────────────────────────────────────────
export const suggestUserNames = async (
  req: FastifyRequest<{ Querystring: { name: string } }>,
  res: FastifyReply,
) => {
  const { name } = req.query;

  const generatedUserNames = generateUsernames(name);

  // Filter out already-taken usernames
  const existing = await prisma.user.findMany({
    where: { username: { in: generatedUserNames } },
    select: { username: true },
  });

  const takenSet = new Set(existing.map((u: { username: string }) => u.username));
  const available = generatedUserNames.filter((u) => !takenSet.has(u));

  return res.status(HTTP_STATUS.OK).send({
    status: true,
    statusCode: HTTP_STATUS.OK,
    error: null,
    data: { suggestions: available },
  });
};
