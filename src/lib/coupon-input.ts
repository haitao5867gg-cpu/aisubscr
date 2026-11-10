import { z } from "zod";

const instant = z.string().trim().min(1).nullable().optional();

export const couponWriteSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9-]+$/),
    kind: z.enum(["PERCENT", "FIXED"]),
    percentOff: z.number().int().min(1).max(100).nullable().optional(),
    amountCents: z.number().int().min(1).max(10_000_000).nullable().optional(),
    minOrderCents: z.number().int().min(0).max(10_000_000).optional(),
    startsAt: instant,
    endsAt: instant,
    maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
    maxUsesPerUser: z.number().int().min(1).max(1_000_000).nullable().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "PERCENT" && (value.percentOff == null || value.percentOff < 1)) {
      ctx.addIssue({ code: "custom", path: ["percentOff"], message: "percent" });
    }
    if (value.kind === "FIXED" && (value.amountCents == null || value.amountCents < 1)) {
      ctx.addIssue({ code: "custom", path: ["amountCents"], message: "amount" });
    }
  });

export type CouponWrite = z.infer<typeof couponWriteSchema>;

/** Datetime-local values are Shanghai wall time. Full ISO strings are accepted too. */
export function parseCouponInstant(value: string | null | undefined) {
  if (value == null || value.trim() === "") return null;
  const trimmed = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}:00+08:00`)
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function couponWriteData(input: CouponWrite) {
  const startsAt = parseCouponInstant(input.startsAt);
  const endsAt = parseCouponInstant(input.endsAt);
  if (startsAt === undefined || endsAt === undefined) return null;
  if (startsAt && endsAt && startsAt >= endsAt) return null;
  return {
    code: input.code.trim().toUpperCase(),
    kind: input.kind,
    percentOff: input.kind === "PERCENT" ? input.percentOff ?? null : null,
    amountCents: input.kind === "FIXED" ? input.amountCents ?? null : null,
    minOrderCents: input.minOrderCents ?? 0,
    startsAt,
    endsAt,
    maxUses: input.maxUses ?? null,
    maxUsesPerUser: input.maxUsesPerUser ?? null,
    active: input.active ?? true,
  };
}

export function couponSnapshot(row: {
  code: string;
  kind: string;
  percentOff: number | null;
  amountCents: number | null;
  minOrderCents: number;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  active: boolean;
  usedCount?: number;
}) {
  return {
    code: row.code,
    kind: row.kind,
    percentOff: row.percentOff,
    amountCents: row.amountCents,
    minOrderCents: row.minOrderCents,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    maxUses: row.maxUses,
    maxUsesPerUser: row.maxUsesPerUser,
    active: row.active,
    usedCount: row.usedCount ?? 0,
  };
}

export { toShanghaiInput } from "./shanghai-input";
