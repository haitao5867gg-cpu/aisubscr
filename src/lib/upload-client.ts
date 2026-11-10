export async function uploadAdminImage(file: File, purpose: "product" | "contact-qr") {
  const body = new FormData();
  body.set("purpose", purpose);
  body.set("file", file);
  const res = await fetch("/api/admin/uploads", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
  if (!res.ok || typeof data.url !== "string") {
    throw new Error(typeof data.error === "string" ? data.error : "");
  }
  return data.url;
}
