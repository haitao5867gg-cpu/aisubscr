import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { isAllowedImageReference } from "./image-ref";

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || isAllowedImageReference(value), { message: "image" });

export function imageFieldRejected(error: { issues: { path: PropertyKey[] }[] }) {
  return error.issues.some((issue) => issue.path[0] === "imageUrl");
}

const fields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(4000),
  priceCents: z.number().int().positive().max(100_000_000),
  isSubscription: z.boolean().optional(),
  active: z.boolean().optional(),
  imageUrl: imageUrl.nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
};

export const productCreateSchema = z.object(fields);
export const productPatchSchema = z.object(fields).partial().refine((value) => Object.keys(value).length > 0, {
  message: "empty",
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;

export function productCreateData(input: ProductCreateInput): Prisma.ProductCreateInput {
  return {
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    isSubscription: input.isSubscription ?? false,
    active: input.active ?? true,
    imageUrl: input.imageUrl ? input.imageUrl : null,
    stock: input.stock ?? null,
    sortOrder: input.sortOrder ?? 0,
  };
}

export function productPatchData(input: ProductPatchInput): Prisma.ProductUpdateInput {
  const data: Prisma.ProductUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.priceCents !== undefined) data.priceCents = input.priceCents;
  if (input.isSubscription !== undefined) data.isSubscription = input.isSubscription;
  if (input.active !== undefined) data.active = input.active;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl ? input.imageUrl : null;
  if (input.stock !== undefined) data.stock = input.stock;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  return data;
}

export function productSnapshot(product: {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  isSubscription: boolean;
  active: boolean;
  stock: number | null;
  sortOrder: number;
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl,
    isSubscription: product.isSubscription,
    active: product.active,
    stock: product.stock,
    sortOrder: product.sortOrder,
  };
}
