import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeTicketCreate } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { deliverAdminNewTicket } from "@/lib/mail/notices";
import { readMutationJson, TICKET_JSON_MAX } from "@/lib/request-guard";
import { getSession } from "@/lib/session";
import { claimTicketUploads, TicketAttachmentError } from "@/lib/ticket-files";
import { TICKET_CATEGORIES, customerReplies, customerTicket, parseTicketUploadIds } from "@/lib/tickets";

const schema = z.object({
  subject: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(4000),
  category: z.enum(TICKET_CATEGORIES),
  orderId: z.string().trim().min(1).max(80).optional(),
  attachments: z.array(z.string()).max(4).optional(),
});

export async function GET() {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.userId },
    include: { order: { select: { id: true, orderNo: true } }, replies: customerReplies },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ tickets: tickets.map(customerTicket) });
}

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  const body = await readMutationJson(req, TICKET_JSON_MAX, t.api.forbidden, t.api.payloadTooLarge);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: t.common.fieldRequired }, { status: 400 });
  const uploadIds = parseTicketUploadIds(parsed.data.attachments);
  if (!uploadIds) return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });

  let orderId: string | null = null;
  if (parsed.data.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, userId: session.userId },
      select: { id: true },
    });
    if (!order) return NextResponse.json({ error: t.api.orderMissing }, { status: 404 });
    orderId = order.id;
  }

  const limit = await consumeTicketCreate(session.userId, clientIp(req.headers));
  if (limit.limited) {
    return NextResponse.json(
      { error: t.api.rateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userId = session.userId;
  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const keys = await claimTicketUploads(tx, userId, uploadIds);
      if (!keys) throw new TicketAttachmentError();
      return tx.ticket.create({
        data: {
          orderId,
          userId,
          subject: parsed.data.subject,
          category: parsed.data.category,
          replies: {
            create: {
              userId,
              body: parsed.data.body,
              isStaff: false,
              attachments: { create: keys.map((url) => ({ url })) },
            },
          },
        },
        include: { order: { select: { id: true, orderNo: true } }, replies: customerReplies },
      });
    });
  } catch (error) {
    if (error instanceof TicketAttachmentError) {
      return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });
    }
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  await deliverAdminNewTicket({
    email: user?.email || session.email || "",
    subject: created.subject,
    category: created.category,
    ticketId: created.id,
  });
  return NextResponse.json({ ticket: customerTicket(created) });
}
