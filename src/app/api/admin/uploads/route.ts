import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { MAX_UPLOAD_BYTES, sniffImage, toWebp, validateUpload } from "@/lib/image-upload";
import { storePublicWebp } from "@/lib/object-storage";
import { logApiError, requestIdFrom } from "@/lib/server-log";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }
  const purpose = form.get("purpose");
  const file = form.get("file");
  const uploadFile = isUploadedFile(file) ? file : null;
  if ((purpose !== "product" && purpose !== "contact-qr") || !uploadFile) {
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }
  if (uploadFile.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }
  const bytes = Buffer.from(await uploadFile.arrayBuffer());
  if (!validateUpload(bytes, uploadFile.type || "")) {
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }

  let webp: Buffer;
  try {
    webp = await toWebp(bytes, purpose);
  } catch {
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }
  if (sniffImage(webp) !== "image/webp" || webp.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }
  try {
    const folder = purpose === "product" ? "products" : "contact-qr";
    const key = `${folder}/${randomUUID()}.webp`;
    const url = await storePublicWebp(key, webp);
    return NextResponse.json({ url });
  } catch (error) {
    logApiError({ requestId: requestIdFrom(req.headers), route: "/api/admin/uploads", status: 400, error });
    return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") return false;
  return typeof value.arrayBuffer === "function" && typeof value.size === "number";
}
