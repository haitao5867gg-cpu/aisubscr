import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { consumeTicketReply } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { deliverTicketStaffReply, mailExcerpt } from "@/lib/mail/notices";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { parseTicketAttachments } from "@/lib/tickets";

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
  internal: z.boolean().optional(),
  attachments: z.array(z.string()).max(4).optional(),
});

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
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.replyRequired }, { status: 400 });
  const attachments = parseTicketAttachments(parsed.data.attachments);
  if (!attachments) return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });
  const internal = Boolean(parsed.data.internal);

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });

  const limit = await consumeTicketReply(session.userId!, clientIp(req.headers));
  if (limit.limited) {
    return NextResponse.json(
      { error: t.api.rateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const actor = actorFrom(session);
  const nextStatus = internal ? ticket.status : "WAITING_CUSTOMER";
  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketReply.create({
      data: {
        ticketId: id,
        userId: session.userId!,
        body: parsed.data.body,
        isStaff: true,
        internal,
        attachments: { create: attachments.map((url) => ({ url })) },
      },
    });
    if (!internal && ticket.status !== nextStatus) {
      await tx.ticket.update({ where: { id }, data: { status: nextStatus } });
    } else {
      await tx.ticket.update({ where: { id }, data: { updatedAt: new Date() } });
    }
    await writeAudit(tx, {
      ...actor,
      action: internal ? "ticket.note" : "ticket.reply",
      targetType: "ticket",
      targetId: id,
      before: { status: ticket.status },
      after: { status: nextStatus, replyId: created.id, internal },
    });
    return created;
  });

  if (!internal) {
    await deliverTicketStaffReply({
      to: ticket.user.email,
      subject: ticket.subject,
      excerpt: mailExcerpt(parsed.data.body),
      ticketId: id,
    });
  }
  return NextResponse.json({ reply: { id: reply.id, internal } });
}
