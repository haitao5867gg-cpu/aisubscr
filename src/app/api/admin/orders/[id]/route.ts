import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

const schema = z.object({
  status: z.enum(["PENDING", "PAID", "COMPLETED", "REFUNDED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const { id } = await params;
  const { status } = schema.parse(await req.json());
  const data: Record<string, unknown> = { status };
  if (status === "PAID") data.paidAt = new Date();
  const order = await prisma.order.update({ where: { id }, data });
  return NextResponse.json({ order });
}
