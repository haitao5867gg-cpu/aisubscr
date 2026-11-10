import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const SEND_MIN_INTERVAL_MS = 60 * 1000;
export const SEND_HOUR_MS = 60 * 60 * 1000;
export const SEND_MAX_PER_HOUR = 5;

type Db = Prisma.TransactionClient;

async function bucketLimited(db: Db, bucket: string, now: number) {
  const recent = await db.passwordResetSend.count({
    where: { bucket, createdAt: { gt: new Date(now - SEND_MIN_INTERVAL_MS) } },
  });
  if (recent >= 1) return true;
  const hour = await db.passwordResetSend.count({
    where: { bucket, createdAt: { gt: new Date(now - SEND_HOUR_MS) } },
  });
  return hour >= SEND_MAX_PER_HOUR;
}

/**
 * Same window as password reset: one send per minute and five per hour for every bucket.
 * Returns false when the window is already full. A successful call records each bucket.
 */
export async function reserveSendWindow(buckets: string[], now = Date.now()) {
  return prisma.$transaction(async (tx) => {
    await tx.passwordResetSend.deleteMany({
      where: { createdAt: { lt: new Date(now - SEND_HOUR_MS) } },
    });
    for (const bucket of buckets) {
      if (await bucketLimited(tx, bucket, now)) return false;
    }
    await tx.passwordResetSend.createMany({
      data: buckets.map((bucket) => ({ bucket })),
    });
    return true;
  });
}
