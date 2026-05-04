import { type Static, Type } from "@sinclair/typebox";

export const OrganizationSchema = Type.Object({
  name: Type.String({ minLength: 2 }),
  slug: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),

  createdAt: Type.Optional(Type.String({ format: "date-time" })),
  updatedAt: Type.Optional(Type.String({ format: "date-time" })),
});

export type OrganizationT = Static<typeof OrganizationSchema>;
