import type { FastifyReply, FastifyRequest } from "fastify";
import {
	ORG_COLLECTION,
	ORG_USER_LINK_COLLECTION,
	PROJECT_COLLECTION,
	USER_COLLECTION,
} from "../../../constants/collectionNames.ts";
import { AppError } from "../../utils/AppError.ts";
import { HTTP_STATUS } from "../../../constants/HTTP_STATUS.ts";
import { filterData } from "../../utils/filterData.ts";
import type { SignInPayloadT, SignUpUserPayloadType } from "./schema.ts";
import type { OrganizationT } from "../../organization/schema.ts";
import {
	OrgPermissions,
	OrgRoles,
	type OrgUserLinkT,
} from "../orgUserLink/schema.ts";
import type { ProjectT } from "../../project/schema.ts";
import { sendOtp } from "../../utils/otp.ts";
import { delCache, getCache } from "../../../lib/node-cache.ts";
import { genLoginToken } from "../../../lib/jwt.ts";
import { compare } from "bcrypt";
import { catchHandler } from "../../utils/catchHandler.ts";
import { compareHashAndData, hashString } from "../../../lib/bcrypt.ts";
import { UserSignedUpWith, type UserT } from "../schema.ts";
import { generateUsernames } from "../../utils/userNameSuggetions.ts";
import { slugify } from "../../utils/slugify.ts";
import { ERROR_CODES } from "../../../constants/constants.ts";

// sign up
export const signup = async (
	req: FastifyRequest<{ Body: SignUpUserPayloadType }>,
	reply: FastifyReply,
) => {
	const db = req.server.mongo.db;

	const { body } = req;

	const userPayload = {
		...filterData.addFields(body.user, [
			"name",
			"username",
			"email",
			"password",
			"profileImageId",
		]),
		password: await hashString(body.user.password),
	} as UserT;

	userPayload.userSignedUpWith = UserSignedUpWith.EMAIL;

	const organizationPayload = filterData.addFields(body.organization, [
		"name",
		"description",
	]) as OrganizationT;

	const projectPayload = filterData.addFields(body.project || {}, [
		"name",
		"description",
	]) as ProjectT;

	const checkUser = await db
		?.collection(USER_COLLECTION)
		.findOne({ email: userPayload.email });

	if (checkUser)
		throw new AppError(
			"You Are already registered on TaskFlow, Please login!",
			HTTP_STATUS.BAD_REQUEST,
		);

	const user = await db?.collection(USER_COLLECTION).insertOne(userPayload);
	if (!user?.insertedId) throw new AppError("User Creation Failed");

	organizationPayload.owner = user.insertedId;

	let slug = slugify(organizationPayload.name);
	const existingSlug = await db?.collection(ORG_COLLECTION).findOne({ slug });
	if (existingSlug) {
		slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
	}
	organizationPayload.slug = slug;

	const organization = await db
		?.collection(ORG_COLLECTION)
		.insertOne(organizationPayload);

	if (!organization?.insertedId)
		throw new AppError("Organization Creation Failed");

	const orgUserLinkPayload: OrgUserLinkT = {
		organizationId: organization.insertedId,
		userId: user.insertedId,
		role: OrgRoles.owner,
		permissions: Object.values(OrgPermissions),
	};

	await db?.collection(ORG_USER_LINK_COLLECTION).insertOne(orgUserLinkPayload);

	projectPayload.organizationId = organization.insertedId;
	projectPayload.createdBy = user.insertedId;

	if (Object.keys(body.project || {}).length) {
		let projectSlug = slugify(projectPayload.name);
		const existingProjectSlug = await db
			?.collection(PROJECT_COLLECTION)
			.findOne({ slug: projectSlug });
		if (existingProjectSlug) {
			projectSlug = `${projectSlug}-${Math.floor(Math.random() * 1000)}`;
		}
		projectPayload.slug = projectSlug;

		const project = await db
			?.collection(PROJECT_COLLECTION)
			.insertOne(projectPayload);

		if (!project?.insertedId) throw new AppError("Project Creation Failed");
	}

	await sendOtp(userPayload.email, userPayload.name);

	return reply.status(HTTP_STATUS.CREATED).send({
		status: true,
		statusCode: HTTP_STATUS.CREATED,
		error: null,
		data: {
			message:
				"To compleat the registration we send a mail to your registered email, please verify.",
		},
	});
};

export const resendOtp = async (
	req: FastifyRequest<{ Body: { email: string } }>,
	reply: FastifyReply,
) => {
	const {
		body: { email },
	} = req;

	const db = req.server.mongo.db;
	const checkData = getCache(email);

	if (!checkData)
		throw new AppError("Please login again", HTTP_STATUS.UNAUTHORIZED);

	const user = await db?.collection(USER_COLLECTION).findOne({ email });
	if (!user) throw new AppError("Please login again", HTTP_STATUS.UNAUTHORIZED);

	await sendOtp(email, user.name);

	return reply.status(HTTP_STATUS.OK).send({
		status: true,
		statusCode: HTTP_STATUS.OK,
		error: null,
		data: {
			message: "Resent ot success.",
		},
	});
};

export const verifyOtp = async (
	req: FastifyRequest<{ Body: { email: string; otp: string } }>,
	reply: FastifyReply,
) => {
	const db = req.server.mongo.db;

	const {
		body: { email, otp },
	} = req;

	if (!email || !otp)
		throw new AppError(
			"Something went wrong! Please login again.",
			HTTP_STATUS.FORBIDDEN,
		);

	const checkData = getCache(email) as { otp: string };

	if (!checkData) throw new AppError("Please login again", 401);

	if (checkData.otp !== otp)
		throw new AppError("Invalid otp", HTTP_STATUS.FORBIDDEN);

	const user = await db?.collection(USER_COLLECTION).findOne({ email });
	if (!user)
		throw new AppError(
			"Something went wrong please login again!",
			HTTP_STATUS.FORBIDDEN,
		);

	const token = genLoginToken({ _id: user?._id });
	delCache(email);

	await db
		?.collection(USER_COLLECTION)
		.updateOne({ email }, { $set: { isEmailVerified: true } });

	return reply.status(HTTP_STATUS.OK).send({
		status: true,
		statusCode: HTTP_STATUS.OK,
		error: null,
		data: {
			message: "Otp verified success.",
			token,
		},
	});
};

export const checkUser = async (
	req: FastifyRequest<{ Body: { email: string } }>,
	reply: FastifyReply,
) => {
	const db = req.server.mongo.db;

	const {
		body: { email },
	} = req;

	const data = await db
		?.collection(USER_COLLECTION)
		.findOne(
			{ email },
			{ projection: { name: true, email: true, userSignedUpWith: true } },
		);

	if (!data)
		throw new AppError(
			"User not found",
			HTTP_STATUS.NOT_FOUND,
			ERROR_CODES.USER_NOT_FOUND,
		);

	return reply.status(HTTP_STATUS.OK).send({
		status: true,
		data: data,
		statusCode: HTTP_STATUS.OK,
		error: null,
	});
};

// sign in
export const signin = async (
	req: FastifyRequest<{ Body: SignInPayloadT }>,
	res: FastifyReply,
) => {
	const { email, password } = req.body;

	const user = await req.server.mongo.db
		?.collection(USER_COLLECTION)
		.findOne({ email });

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
		data: {
			message: "Otp sent to your registered email.",
		},
	});
};

export const suggestUserNames = async (
	req: FastifyRequest<{ Querystring: { name: string } }>,
	res: FastifyReply,
) => {
	const { name } = req.query;
	const db = req.server.mongo.db;

	const generatedUserNames = generateUsernames(name);

	const existing = await db
		?.collection(USER_COLLECTION)
		.find({ username: { $in: generatedUserNames } })
		.toArray();

	if (existing) {
		for (const u of existing) {
			const uni = generatedUserNames.findIndex(u.username);
			if (uni < 0) continue;

			generatedUserNames.splice(1, uni);
		}
	}

	return res.status(HTTP_STATUS.OK).send({
		status: true,
		statusCode: HTTP_STATUS.OK,
		error: null,
		data: {
			suggestions: generatedUserNames, //returning top 6 user names
		},
	});
};
