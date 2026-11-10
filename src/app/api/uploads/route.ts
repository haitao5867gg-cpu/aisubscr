import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeTicketUpload } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { MAX_UPLOAD_BYTES, sniffImage, toWebp, validateUpload } from "@/lib/image-upload";
import { storePublicWebp } from "@/lib/object-storage";
import { logApiError, requestIdFrom } from "@/lib/server-log";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Signed-in ticket screenshots. Same sniff, size cap, and WebP conversion as
 * the admin product upload. Stored under tickets/<uuid>.webp.
 */
export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
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
  try {
    const url = await storePublicWebp(`tickets/${randomUUID()}.webp`, webp);
    return NextResponse.json({ url });
  } catch (error) {
    logApiError({ requestId: requestIdFrom(req.headers), route: "/api/uploads", status: 400, error });
    return NextResponse.json({ error: t.ticket.uploadInvalid }, { status: 400 });
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") return false;
  return typeof value.arrayBuffer === "function" && typeof value.size === "number";
}
