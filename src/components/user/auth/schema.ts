import { Type, type Static } from "@sinclair/typebox";
import { OrganizationSchema } from "../../organization/schema.ts";
import { ProjectSchema } from "../../project/schema.ts";
import { UserSchema } from "../schema.ts";

const CheckUserSchema = Type.Object({
  email: Type.String({ format: "email" }),
});

const SignUpSchema = Type.Object({
  user: Type.Object(UserSchema),
  organization: Type.Object(OrganizationSchema),
  project: Type.Optional(Type.Object(ProjectSchema)),
});

export const SignInSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String(),
});

export type CheckUserPayloadT = Static<typeof CheckUserSchema>;
export type SignUpUserPayloadType = Static<typeof SignUpSchema>;
export type SignInPayloadT = Static<typeof SignInSchema>;