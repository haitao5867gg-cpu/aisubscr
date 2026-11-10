import { Prisma } from "@prisma/client";
import { prisma } from "../db";

const PAYABLE = ["PENDING", "PAYING"] as const;
const SETTLED = ["PAID", "COMPLETED", "REFUNDING", "REFUNDED"] as const;

export type ConfirmPaymentInput = {
  orderNo: string;
  provider: string;
  providerEventId: string;
  amountCents: number;
  method: string;
  success: boolean;
};

export type ConfirmPaymentResult =
  | { ok: true; orderId: string; status: string; applied: boolean; duplicate: boolean }
  | { ok: false; reason: "NOT_FOUND" | "AMOUNT" | "NOT_SUCCESS" | "STATE" };

/**
 * Apply a verified payment notice once.
 * The unique (provider, providerEventId) row makes retries a no-op.
 * A second successful event for an order that is already paid does not
 * change the order again.
 */
export async function confirmOrderPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentNotice.findUnique({
        where: {
          provider_providerEventId: {
            provider: input.provider,
            providerEventId: input.providerEventId,
          },
        },
      });
      if (existing) {
        const order = await tx.order.findUnique({ where: { orderNo: input.orderNo } });
        if (!order) return { ok: false, reason: "NOT_FOUND" };
        return { ok: true, orderId: order.id, status: order.status, applied: false, duplicate: true };
      }

      const order = await tx.order.findUnique({ where: { orderNo: input.orderNo } });
      if (!order) return { ok: false, reason: "NOT_FOUND" };

      const notice = {
        provider: input.provider,
        providerEventId: input.providerEventId,
        orderNo: input.orderNo,
        amountCents: input.amountCents,
      };

      if (order.totalCents !== input.amountCents) {
        await tx.paymentNotice.create({ data: { ...notice, outcome: "REJECTED" } });
        return { ok: false, reason: "AMOUNT" };
      }
      if (!input.success) {
        await tx.paymentNotice.create({ data: { ...notice, outcome: "REJECTED" } });
        return { ok: false, reason: "NOT_SUCCESS" };
      }
      if ((SETTLED as readonly string[]).includes(order.status)) {
        await tx.paymentNotice.create({ data: { ...notice, outcome: "DUPLICATE" } });
        return { ok: true, orderId: order.id, status: order.status, applied: false, duplicate: true };
      }
      if (!(PAYABLE as readonly string[]).includes(order.status)) {
        await tx.paymentNotice.create({ data: { ...notice, outcome: "REJECTED" } });
        return { ok: false, reason: "STATE" };
      }

      const updated = await tx.order.updateMany({
        where: { id: order.id, status: { in: [...PAYABLE] } },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: input.method,
          paymentProvider: input.provider,
        },
      });
      await tx.paymentNotice.create({
        data: { ...notice, outcome: updated.count === 1 ? "APPLIED" : "DUPLICATE" },
      });
      const fresh = await tx.order.findUnique({ where: { id: order.id } });
      return {
        ok: true,
        orderId: order.id,
        status: fresh?.status ?? order.status,
        applied: updated.count === 1,
        duplicate: updated.count !== 1,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const order = await prisma.order.findUnique({ where: { orderNo: input.orderNo } });
      if (!order) return { ok: false, reason: "NOT_FOUND" };
      return { ok: true, orderId: order.id, status: order.status, applied: false, duplicate: true };
    }
    throw error;
  }
}
