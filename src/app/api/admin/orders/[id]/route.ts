import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { canAdminSet, ORDER_STATUSES } from "@/lib/payments/states";

const schema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "状态无效" }, { status: 400 });
  const current = await prisma.order.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  if (!canAdminSet(current.status, parsed.data.status)) {
    return NextResponse.json({ error: "订单状态不可这样变更" }, { status: 400 });
  }
  const data: { status: string; paidAt?: Date } = { status: parsed.data.status };
  if ((parsed.data.status === "PAID" || parsed.data.status === "COMPLETED") && !current.paidAt) {
    data.paidAt = new Date();
  }
  const order = await prisma.order.update({ where: { id }, data });
  return NextResponse.json({ order });
}
