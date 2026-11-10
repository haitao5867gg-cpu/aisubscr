import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeTicketReply } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { readMutationJson, TICKET_JSON_MAX } from "@/lib/request-guard";
import { getSession } from "@/lib/session";
import { claimTicketUploads, TicketAttachmentError } from "@/lib/ticket-files";
import { parseTicketUploadIds, presentAttachment } from "@/lib/tickets";

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: z.array(z.string()).max(4).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  const body = await readMutationJson(req, TICKET_JSON_MAX, t.api.forbidden, t.api.payloadTooLarge);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: t.api.replyRequired }, { status: 400 });
  const uploadIds = parseTicketUploadIds(parsed.data.attachments);
  if (!uploadIds) return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });

  const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });

  const limit = await consumeTicketReply(session.userId, clientIp(req.headers));
  if (limit.limited) {
    return NextResponse.json(
      { error: t.api.rateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = session.userId;
  let reply;
  try {
    reply = await prisma.$transaction(async (tx) => {
      const keys = await claimTicketUploads(tx, userId, uploadIds);
      if (!keys) throw new TicketAttachmentError();
      const created = await tx.ticketReply.create({
        data: {
          ticketId: ticket.id,
          userId,
          body: parsed.data.body,
          isStaff: false,
          internal: false,
          attachments: { create: keys.map((url) => ({ url })) },
        },
        include: { attachments: true },
      });
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
      return created;
    });
  } catch (error) {
    if (error instanceof TicketAttachmentError) {
      return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({
    reply: {
      id: reply.id,
      body: reply.body,
      isStaff: false,
      createdAt: reply.createdAt,
      attachments: reply.attachments.map((item) => presentAttachment(item)),
    },
  });
}
