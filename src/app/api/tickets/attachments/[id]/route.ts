import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { TICKET_CACHE_CONTROL } from "@/lib/serve-upload";
import { adminAuthResponse, getSession, requireAdmin } from "@/lib/session";
import { openTicketFile } from "@/lib/ticket-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ticket screenshot. The id is the attachment row, not the file name.
 * The signed-in owner and an enrolled admin can read it. Everyone else gets 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const row = await prisma.ticketAttachment.findUnique({
    where: { id },
    select: { url: true, reply: { select: { ticket: { select: { userId: true } } } } },
  });
  if (!row) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const owner = row.reply.ticket.userId === session.userId;
  if (!owner) {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: t.api.ticketMissing }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    try {
      await requireAdmin();
    } catch (error) {
      const denied = await adminAuthResponse(error);
      if (denied) return denied;
      throw error;
    }
  }

  const opened = await openTicketFile(row.url);
  if (!opened) {
    return NextResponse.json({ error: t.api.ticketMissing }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  opened.stream.on("error", () => {
    opened.stream.destroy();
  });
  return new NextResponse(Readable.toWeb(opened.stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": opened.contentType,
      "Content-Length": String(opened.size),
      "Cache-Control": TICKET_CACHE_CONTROL,
      "CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "X-Robots-Tag": "noindex",
    },
  });
}
