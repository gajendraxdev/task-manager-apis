// biome-ignore lint/suspicious/noExplicitAny: intentional any type for flexibility
export type AnyType = any | any[];

// Prisma uses string cuid/uuid IDs — no ObjectId needed
export type OID = string;
