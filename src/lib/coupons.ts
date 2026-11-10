import { Prisma } from "@prisma/client";
import type { Dict } from "@/i18n";

export const COUPON_ERRORS = [
  "COUPON_NOT_FOUND",
  "COUPON_INACTIVE",
  "COUPON_NOT_STARTED",
  "COUPON_EXPIRED",
  "COUPON_MIN_ORDER",
  "COUPON_LIMIT",
  "COUPON_USER_LIMIT",
  "COUPON_INVALID",
] as const;

export type CouponErrorCode = (typeof COUPON_ERRORS)[number];

type CouponRow = {
  id: string;
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
};

export type ReservedCoupon = {
  couponId: string;
  code: string;
  discountCents: number;
};

export function normalizeCouponCode(raw: string) {
  return raw.trim().toUpperCase();
}

export function isCouponError(error: unknown): error is Error & { message: CouponErrorCode } {
  return error instanceof Error && (COUPON_ERRORS as readonly string[]).includes(error.message);
}

export function couponErrorMessage(code: string, t: Dict) {
  const map: Record<CouponErrorCode, string> = {
    COUPON_NOT_FOUND: t.coupon.notFound,
    COUPON_INACTIVE: t.coupon.inactive,
    COUPON_NOT_STARTED: t.coupon.notStarted,
    COUPON_EXPIRED: t.coupon.expired,
    COUPON_MIN_ORDER: t.coupon.minOrder,
    COUPON_LIMIT: t.coupon.limit,
    COUPON_USER_LIMIT: t.coupon.userLimit,
    COUPON_INVALID: t.coupon.invalid,
  };
  return (map as Record<string, string>)[code] ?? null;
}

/** Discount in fen, never above the subtotal. Percent uses half-up rounding. */
export function couponDiscountCents(
  coupon: { kind: string; percentOff: number | null; amountCents: number | null },
  subtotalCents: number,
) {
  let discount = 0;
  if (coupon.kind === "PERCENT") {
    const percent = coupon.percentOff ?? 0;
    if (percent < 1 || percent > 100) throw new Error("COUPON_INVALID");
    discount = Math.round((subtotalCents * percent) / 100);
  } else if (coupon.kind === "FIXED") {
    const amount = coupon.amountCents ?? 0;
    if (amount < 1) throw new Error("COUPON_INVALID");
    discount = amount;
  } else {
    throw new Error("COUPON_INVALID");
  }
  if (discount < 1) throw new Error("COUPON_INVALID");
  return Math.min(discount, subtotalCents);
}

function assertWindow(coupon: CouponRow, subtotalCents: number, now: Date) {
  if (!coupon.active) throw new Error("COUPON_INACTIVE");
  if (coupon.startsAt && coupon.startsAt > now) throw new Error("COUPON_NOT_STARTED");
  if (coupon.endsAt && coupon.endsAt <= now) throw new Error("COUPON_EXPIRED");
  if (subtotalCents < coupon.minOrderCents) throw new Error("COUPON_MIN_ORDER");
}

/**
 * Reserve one use inside the order transaction.
 * The global and per-user counters only move with a conditional update, so two
 * checkouts cannot both pass a cap. The caller must insert CouponRedemption
 * before the transaction commits. A thrown error rolls the increments back.
 */
export async function reserveCoupon(
  tx: Prisma.TransactionClient,
  input: { code: string; userId: string; subtotalCents: number; now?: Date },
): Promise<ReservedCoupon> {
  const code = normalizeCouponCode(input.code);
  if (!code) throw new Error("COUPON_NOT_FOUND");
  const now = input.now ?? new Date();
  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) throw new Error("COUPON_NOT_FOUND");
  assertWindow(coupon, input.subtotalCents, now);
  const discountCents = couponDiscountCents(coupon, input.subtotalCents);

  const global = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      active: true,
      ...(coupon.maxUses != null ? { usedCount: { lt: coupon.maxUses } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (global.count !== 1) {
    const again = await tx.coupon.findUnique({ where: { id: coupon.id } });
    if (!again?.active) throw new Error("COUPON_INACTIVE");
    throw new Error("COUPON_LIMIT");
  }

  await tx.couponUserUsage.upsert({
    where: { couponId_userId: { couponId: coupon.id, userId: input.userId } },
    create: { couponId: coupon.id, userId: input.userId, usedCount: 0 },
    update: {},
  });
  const perUser = await tx.couponUserUsage.updateMany({
    where: {
      couponId: coupon.id,
      userId: input.userId,
      ...(coupon.maxUsesPerUser != null ? { usedCount: { lt: coupon.maxUsesPerUser } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (perUser.count !== 1) throw new Error("COUPON_USER_LIMIT");

  return { couponId: coupon.id, code: coupon.code, discountCents };
}

/** Give back a reserved use. Safe to call twice. */
export async function releaseCouponHold(
  tx: Prisma.TransactionClient,
  redemption: { id: string; couponId: string; userId: string; releasedAt: Date | null } | null,
) {
  if (!redemption || redemption.releasedAt) return;
  const marked = await tx.couponRedemption.updateMany({
    where: { id: redemption.id, releasedAt: null },
    data: { releasedAt: new Date() },
  });
  if (marked.count !== 1) return;
  await tx.coupon.updateMany({
    where: { id: redemption.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
  await tx.couponUserUsage.updateMany({
    where: { couponId: redemption.couponId, userId: redemption.userId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}

/** Read-only check for the checkout preview. Does not reserve a use. */
export async function quoteCoupon(
  tx: Prisma.TransactionClient,
  input: { code: string; userId: string; subtotalCents: number; now?: Date },
) {
  const code = normalizeCouponCode(input.code);
  if (!code) throw new Error("COUPON_NOT_FOUND");
  const now = input.now ?? new Date();
  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) throw new Error("COUPON_NOT_FOUND");
  assertWindow(coupon, input.subtotalCents, now);
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new Error("COUPON_LIMIT");
  if (coupon.maxUsesPerUser != null) {
    const usage = await tx.couponUserUsage.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId: input.userId } },
    });
    if (usage && usage.usedCount >= coupon.maxUsesPerUser) throw new Error("COUPON_USER_LIMIT");
  }
  const discountCents = couponDiscountCents(coupon, input.subtotalCents);
  return { code: coupon.code, discountCents, subtotalCents: input.subtotalCents, totalCents: input.subtotalCents - discountCents };
}
