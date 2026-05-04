import { type Static, Type } from "@sinclair/typebox";

export const DocumentCreateSchema = Type.Object({
  originalname: Type.String(),
  name: Type.String(),
  path: Type.String(),
  type: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),

  createdAt: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
});

export const DocumentSchema = Type.Object({
  _id: Type.Optional(Type.String()),
  originalname: Type.String(),
  name: Type.String(),
  path: Type.String(),
  type: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),

  createdAt: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
});

export type DocumentT = Static<typeof DocumentSchema>;
