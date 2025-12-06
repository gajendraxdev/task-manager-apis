import { type Static, Type } from "@sinclair/typebox";
import type { ObjectId } from "mongodb";

export const OrganizationSchema = Type.Object({
  name: Type.Required(Type.String({ minLength: 2 })),
  slug: Type.Optional(Type.String()),
  owner: Type.Unsafe<ObjectId>({ type: "string" }),
  description: Type.Optional(Type.String()),

  createdAt: Type.Optional(Type.String({ format: "date-time" })),
  updatedAt: Type.Optional(Type.String({ format: "date-time" })),
});

export type OrganizationT = Static<typeof OrganizationSchema>;
