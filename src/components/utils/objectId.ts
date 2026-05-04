/**
 * Legacy ObjectId utilities — kept as stubs after MongoDB → Prisma migration.
 * Prisma uses string cuid IDs, so these are no-ops.
 */

export const validObjectId = (id: string): boolean => {
  return typeof id === "string" && id.length > 0;
};

export const objectId = (id: string): string => {
  return id;
};
