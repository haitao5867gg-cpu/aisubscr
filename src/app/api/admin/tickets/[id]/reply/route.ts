import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { consumeTicketReply } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { deliverTicketStaffReply, mailExcerpt } from "@/lib/mail/notices";
import { readMutationJson, TICKET_JSON_MAX } from "@/lib/request-guard";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { claimTicketUploads, TicketAttachmentError } from "@/lib/ticket-files";
import { parseTicketUploadIds } from "@/lib/tickets";

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
  const body = await readMutationJson(req, TICKET_JSON_MAX, t.api.forbidden, t.api.payloadTooLarge);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: t.api.replyRequired }, { status: 400 });
  const uploadIds = parseTicketUploadIds(parsed.data.attachments);
  if (!uploadIds) return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });
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
  const userId = session.userId!;
  let reply;
  try {
    reply = await prisma.$transaction(async (tx) => {
      const keys = await claimTicketUploads(tx, userId, uploadIds);
      if (!keys) throw new TicketAttachmentError();
      const created = await tx.ticketReply.create({
        data: {
          ticketId: id,
          userId,
          body: parsed.data.body,
          isStaff: true,
          internal,
          attachments: { create: keys.map((url) => ({ url })) },
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
  } catch (error) {
    if (error instanceof TicketAttachmentError) {
      return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });
    }
    throw error;
  }

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
