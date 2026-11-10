import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { releaseCouponHold } from "./coupons";

export const UNPAID_STATUSES = ["PENDING", "PAYING"] as const;

const DEFAULT_EXPIRE_MINUTES = 30;
const MAX_EXPIRE_MINUTES = 24 * 60;

/**
 * Env wins when it is a whole number of minutes, so a host can set the window
 * without a database write. Otherwise the admin setting is used. Default 30.
 */
export function resolveExpireMinutes(stored?: number | null) {
  const envRaw = process.env.ORDER_EXPIRE_MINUTES?.trim() ?? "";
  if (envRaw) {
    const env = Number(envRaw);
    if (Number.isInteger(env) && env >= 1 && env <= MAX_EXPIRE_MINUTES) return env;
  }
  if (stored != null && Number.isInteger(stored) && stored >= 1 && stored <= MAX_EXPIRE_MINUTES) return stored;
  return DEFAULT_EXPIRE_MINUTES;
}

export function orderExpiresAt(minutes: number, now = new Date()) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/** Put stock back for lines that reserved a finite stock count. */
export async function releaseStock(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true, product: { select: { stock: true } } },
  });
  for (const item of items) {
    if (item.product.stock === null) continue;
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

export async function releaseUnpaidHold(tx: Prisma.TransactionClient, orderId: string) {
  await releaseStock(tx, orderId);
  const redemption = await tx.couponRedemption.findUnique({ where: { orderId } });
  await releaseCouponHold(tx, redemption);
}

/**
 * Expire one unpaid order whose deadline has passed.
 * The status update is conditional, so payment and expiry cannot both win,
 * and a second call does not release stock or a coupon again.
 */
export async function expireOrderIfDue(
  tx: Prisma.TransactionClient,
  order: { id: string; status: string; expiresAt: Date | null },
  now = new Date(),
) {
  if (!order.expiresAt || order.expiresAt > now) return false;
  if (order.status !== "PENDING" && order.status !== "PAYING") return false;
  const updated = await tx.order.updateMany({
    where: {
      id: order.id,
      status: { in: [...UNPAID_STATUSES] },
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
  if (updated.count !== 1) return false;
  await releaseUnpaidHold(tx, order.id);
  return true;
}

/** Idempotent sweep used by page loads and the cron entrypoint. */
export async function expireDueOrders(now = new Date()) {
  const due = await prisma.order.findMany({
    where: {
      status: { in: [...UNPAID_STATUSES] },
      expiresAt: { lte: now },
    },
    select: { id: true, status: true, expiresAt: true },
  });
  let expired = 0;
  for (const order of due) {
    const did = await prisma.$transaction((tx) => expireOrderIfDue(tx, order, now));
    if (did) expired += 1;
  }
  return { expired, scanned: due.length };
}

/** Shared secret for POST /api/internal/expire-orders. Missing secret disables the route. */
export function cronAuth(authorization: string | null): "ok" | "denied" | "disabled" {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (secret.length < 16) return "disabled";
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return "denied";
  if (!timingSafeEqual(provided, expected)) return "denied";
  return "ok";
}
