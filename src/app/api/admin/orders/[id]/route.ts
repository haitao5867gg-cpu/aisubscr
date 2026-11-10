import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { deliverOrderPaid } from "@/lib/mail/notices";
import { releaseUnpaidHold, UNPAID_STATUSES } from "@/lib/order-expiry";
import { refreshPublic } from "@/lib/public-content";
import { canAdminSet, ORDER_STATUSES } from "@/lib/payments/states";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

const schema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().min(1).max(500),
});

function orderSnapshot(order: {
  status: string;
  paidAt: Date | null;
  paymentMethod: string | null;
  totalCents: number;
}) {
  return {
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
    paymentMethod: order.paymentMethod,
    totalCents: order.totalCents,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const record = typeof json === "object" && json ? (json as Record<string, unknown>) : {};
    const noteMissing = typeof record.note !== "string" || record.note.trim().length === 0;
    return NextResponse.json({ error: noteMissing ? t.admin.noteRequired : t.admin.invalidStatus }, { status: 400 });
  }
  const current = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { email: true } }, items: { select: { productName: true, quantity: true } } },
  });
  if (!current) return NextResponse.json({ error: t.admin.orderMissing }, { status: 404 });
  if (current.status === parsed.data.status || !canAdminSet(current.status, parsed.data.status)) {
    return NextResponse.json({ error: t.admin.invalidTransition }, { status: 400 });
  }
  const data: { status: string; paidAt?: Date } = { status: parsed.data.status };
  const settling = parsed.data.status === "PAID" || parsed.data.status === "COMPLETED";
  const newlyPaid = settling && !current.paidAt;
  if (newlyPaid) data.paidAt = new Date();
  const actor = actorFrom(session);
  const closingUnpaid =
    (parsed.data.status === "CANCELLED" || parsed.data.status === "EXPIRED" || parsed.data.status === "FAILED") &&
    (UNPAID_STATUSES as readonly string[]).includes(current.status);
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, status: current.status },
        data,
      });
      if (updated.count !== 1) throw new Error("CONFLICT");
      if (closingUnpaid) await releaseUnpaidHold(tx, id);
      const fresh = await tx.order.findUniqueOrThrow({ where: { id } });
      await writeAudit(tx, {
        ...actor,
        action: "order.status",
        targetType: "order",
        targetId: id,
        note: parsed.data.note,
        before: orderSnapshot(current),
        after: orderSnapshot(fresh),
      });
      return fresh;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return NextResponse.json({ error: t.admin.invalidTransition }, { status: 409 });
    }
    throw error;
  }
  if (closingUnpaid) refreshPublic("catalog");
  if (newlyPaid) {
    await deliverOrderPaid({
      to: current.user.email,
      orderNo: current.orderNo,
      totalCents: current.totalCents,
      items: current.items,
    });
  }
  return NextResponse.json({ order });
}
