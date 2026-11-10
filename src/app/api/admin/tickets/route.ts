import { NextRequest, NextResponse } from "next/server";
import { adminTicketWhere, readTicketFilters } from "@/lib/admin-tickets";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const filters = readTicketFilters(req.nextUrl.searchParams, session.userId);
  const tickets = await prisma.ticket.findMany({
    where: adminTicketWhere(filters),
    include: {
      user: { select: { email: true, name: true } },
      assignee: { select: { id: true, email: true, name: true } },
      order: { select: { id: true, orderNo: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ tickets });
}
