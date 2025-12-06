import { type Static, Type } from "@sinclair/typebox";

export enum UserRoles {
	manager = "manager",
	user = "user",
	admin = "admin",
	reviewer = "reviewer",
	owner = "owner",
}

export enum UserSignedUpWith {
	EMAIL = "EMAIL",
	GOOGLE = "GOOGLE",
	MICROSOFT = "MICROSOFT",
}

export const WebAuthnCredentialSchema = Type.Object({
	credentialId: Type.String(),
	publicKey: Type.String(),
	counter: Type.Number(),
	deviceName: Type.Optional(Type.String()),
	lastUsedAt: Type.Optional(Type.Date()),
});

export const UserSchema = Type.Object({
	name: Type.String(),
	username: Type.String(),
	email: Type.String({ format: "email" }),
	password: Type.String(),
	role: Type.Optional(Type.Enum(UserRoles)),

	profileImageId: Type.Optional(Type.String()),

	userSignedUpWith: Type.Optional(Type.Enum(UserSignedUpWith)),

	isActive: Type.Optional(Type.Boolean()),
	isEmailVerified: Type.Optional(Type.Boolean()),
	webauthnCredentials: Type.Optional(Type.Array(WebAuthnCredentialSchema)),
	createdAt: Type.Optional(Type.Date()),
	updatedAt: Type.Optional(Type.Date()),
});

const SignInSchema = Type.Object({
	name: Type.String(),
	email: Type.String({ format: "email" }),
	password: Type.String(),
	role: Type.Optional(Type.Enum(UserRoles)),

	profileImageId: Type.Optional(Type.String()),

	workspaceId: Type.Optional(Type.String()), // for req body
	organizationId: Type.Optional(Type.String()), // for req body

	isActive: Type.Optional(Type.Boolean()),
	createdAt: Type.Optional(Type.Date()),
	updatedAt: Type.Optional(Type.Date()),
});

export type UserT = Static<typeof UserSchema>;
