import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  const ticket = await prisma.ticket.findFirst({
    where: { id, userId: session.userId },
    include: {
      order: true,
      replies: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true, role: true } } } },
    },
  });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });
  return NextResponse.json({ ticket });
}
