import { NextResponse } from "next/server";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const orders = await prisma.order.findMany({
    include: { items: true, user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}
