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
