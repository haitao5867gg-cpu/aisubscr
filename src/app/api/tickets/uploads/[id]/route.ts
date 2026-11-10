import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { TICKET_CACHE_CONTROL } from "@/lib/serve-upload";
import { getSession } from "@/lib/session";
import { openTicketFile } from "@/lib/ticket-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Preview of a screenshot that is not on a ticket yet. Only the uploader can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const row = await prisma.ticketUpload.findFirst({
    where: { id, userId: session.userId },
    select: { key: true },
  });
  if (!row) {
    return NextResponse.json({ error: t.api.ticketMissing }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const opened = await openTicketFile(row.key);
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
