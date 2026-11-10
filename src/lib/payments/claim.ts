import { prisma } from "../db";

/** Move an order to PAYING only while it is still unpaid. A cancel or expiry in between does not reopen it. */
export function claimPayableOrder(
  orderId: string,
  data: { paymentMethod: string; paymentProvider: string },
) {
  return prisma.order.updateMany({
    where: { id: orderId, status: { in: ["PENDING", "PAYING"] } },
    data: { ...data, status: "PAYING" },
  });
}
