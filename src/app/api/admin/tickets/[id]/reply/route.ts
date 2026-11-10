import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

const schema = z.object({ body: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const t = getDict(await getLocale());
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.replyRequired }, { status: 400 });
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
