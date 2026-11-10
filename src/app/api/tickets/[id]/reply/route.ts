import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeTicketReply } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseTicketAttachments } from "@/lib/tickets";

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
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.replyRequired }, { status: 400 });
  const attachments = parseTicketAttachments(parsed.data.attachments);
  if (!attachments) return NextResponse.json({ error: t.api.attachmentInvalid }, { status: 400 });

  const ticket = await prisma.ticket.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });

  const limit = await consumeTicketReply(session.userId, clientIp(req.headers));
  if (limit.limited) {
    return NextResponse.json(
      { error: t.api.rateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketReply.create({
      data: {
        ticketId: ticket.id,
        userId: session.userId!,
        body: parsed.data.body,
        isStaff: false,
        internal: false,
        attachments: { create: attachments.map((url) => ({ url })) },
      },
      include: { attachments: true },
    });
    await tx.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
    return created;
  });
  return NextResponse.json({
    reply: {
      id: reply.id,
      body: reply.body,
      isStaff: false,
      createdAt: reply.createdAt,
      attachments: reply.attachments.map((item) => ({ id: item.id, url: item.url })),
    },
  });
}
