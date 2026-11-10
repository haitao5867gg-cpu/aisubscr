import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actorFrom, writeAudit } from "@/lib/audit";
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
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请填写回复" }, { status: 400 });
  const actor = actorFrom(session);
  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketReply.create({
      data: { ticketId: id, userId: session.userId!, body: parsed.data.body, isStaff: true },
    });
    await tx.ticket.update({ where: { id }, data: { status: "REPLIED" } });
    await writeAudit(tx, {
      ...actor,
      action: "ticket.reply",
      targetType: "ticket",
      targetId: id,
      before: { status: ticket.status },
      after: { status: "REPLIED", replyId: created.id },
    });
    return created;
  });
  return NextResponse.json({ reply });
}
