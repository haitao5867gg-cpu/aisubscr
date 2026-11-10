import type { Prisma } from "@prisma/client";

export const catalogOrderBy: Prisma.ProductOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { createdAt: "asc" },
];

export function inStock(product: { stock: number | null }, quantity = 1) {
  return product.stock === null || product.stock >= quantity;
}
