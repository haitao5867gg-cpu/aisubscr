import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeTicketUpload } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES, sniffImage, toWebp, validateUpload } from "@/lib/image-upload";
import { storeTicketWebp } from "@/lib/object-storage";
import { declaredBodyTooLarge, sameOriginMutation } from "@/lib/request-guard";
import { logApiError, requestIdFrom } from "@/lib/server-log";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** Multipart overhead on top of the 5 MB image cap. */
const MAX_UPLOAD_BODY = MAX_UPLOAD_BYTES + 256 * 1024;

/**
 * Signed-in ticket screenshots. Same sniff, size cap, and WebP conversion as
 * the admin product upload. The file stays on local disk under tickets/<uuid>.webp.
 * The returned URL is an authenticated preview, not a public /uploads path.
 */
export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  if (!sameOriginMutation(req)) {
    return NextResponse.json({ error: t.api.forbidden }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (declaredBodyTooLarge(req.headers, MAX_UPLOAD_BODY)) {
    return NextResponse.json({ error: t.api.payloadTooLarge }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }

  const limit = await consumeTicketUpload(session.userId, clientIp(req.headers));
  if (limit.limited) {
    return NextResponse.json(
      { error: t.api.rateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }
  const purpose = form.get("purpose");
  const file = form.get("file");
  const uploadFile = isUploadedFile(file) ? file : null;
  if (purpose !== "ticket" || !uploadFile || uploadFile.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }
  const bytes = Buffer.from(await uploadFile.arrayBuffer());
  if (!validateUpload(bytes, uploadFile.type || "")) {
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }

  let webp: Buffer;
  try {
    webp = await toWebp(bytes, "ticket");
  } catch {
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }
  if (sniffImage(webp) !== "image/webp" || webp.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }
  const key = `tickets/${randomUUID()}.webp`;
  try {
    await storeTicketWebp(key, webp);
    const row = await prisma.ticketUpload.create({
      data: { userId: session.userId, key },
      select: { id: true },
    });
    return NextResponse.json({ url: `/api/tickets/uploads/${row.id}` });
  } catch (error) {
    logApiError({ requestId: requestIdFrom(req.headers), route: "/api/uploads", status: 400, error });
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") return false;
  return typeof value.arrayBuffer === "function" && typeof value.size === "number";
}
