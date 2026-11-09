import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const tickets = await prisma.ticket.findMany({
    include: {
      user: { select: { email: true, name: true } },
      order: true,
      replies: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ tickets });
}
