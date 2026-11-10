import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

const schema = z.object({ body: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  const { body } = schema.parse(await req.json());
  const reply = await prisma.ticketReply.create({
    data: { ticketId: id, userId: session.userId!, body, isStaff: true },
  });
  await prisma.ticket.update({ where: { id }, data: { status: "REPLIED" } });
  return NextResponse.json({ reply });
}
