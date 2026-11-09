import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

const schema = z.object({ body: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.userId } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  const { body } = schema.parse(await req.json());
  const reply = await prisma.ticketReply.create({
    data: { ticketId: ticket.id, userId: session.userId, body, isStaff: false },
  });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
  return NextResponse.json({ reply });
}
