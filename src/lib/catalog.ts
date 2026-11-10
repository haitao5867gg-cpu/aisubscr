import type { Prisma } from "@prisma/client";

export const catalogOrderBy: Prisma.ProductOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
];

/** One line cannot reserve more than this many units. */
export const MAX_LINE_QUANTITY = 99;

export function inStock(product: { stock: number | null }, quantity = 1) {
  return product.stock === null || product.stock >= quantity;
}

/** Whole units from 1 through MAX_LINE_QUANTITY. Rejects strings, zero, and overflow. */
export function lineQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_LINE_QUANTITY) return null;
  return value;
}
