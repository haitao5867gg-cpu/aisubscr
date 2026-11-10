import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeTicketCreate } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { deliverAdminNewTicket } from "@/lib/mail/notices";
import { getSession } from "@/lib/session";
import { TICKET_CATEGORIES, customerReplies, customerTicket, parseTicketAttachments } from "@/lib/tickets";

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
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.common.fieldRequired }, { status: 400 });
  const attachments = parseTicketAttachments(parsed.data.attachments);
  if (!attachments) return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });

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

  const created = await prisma.ticket.create({
    data: {
      orderId,
      userId: session.userId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      replies: {
        create: {
          userId: session.userId,
          body: parsed.data.body,
          isStaff: false,
          attachments: { create: attachments.map((url) => ({ url })) },
        },
      },
    },
    include: { order: { select: { id: true, orderNo: true } }, replies: customerReplies },
  });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  await deliverAdminNewTicket({
    email: user?.email || session.email || "",
    subject: created.subject,
    category: created.category,
    ticketId: created.id,
  });
  return NextResponse.json({ ticket: customerTicket(created) });
}
