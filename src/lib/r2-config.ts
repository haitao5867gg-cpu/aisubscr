export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  origin: string;
};

function cleanBase(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.protocol === "http:" && process.env.NODE_ENV === "production") return null;
  const path = url.pathname.replace(/\/+$/, "");
  const base = `${url.origin}${path === "/" ? "" : path}`;
  return { base, origin: url.origin };
}

/** Origin allowed in CSP img-src. Null when the public base URL is missing or not http(s). */
export function r2ImageOrigin() {
  return cleanBase(process.env.R2_PUBLIC_BASE_URL ?? "")?.origin ?? null;
}

export function r2PublicBaseUrl() {
  return cleanBase(process.env.R2_PUBLIC_BASE_URL ?? "")?.base ?? null;
}

/** All five variables must be set. Otherwise uploads stay on the local disk. */
export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_PUBLIC_BUCKET?.trim() ?? "";
  const parsed = cleanBase(process.env.R2_PUBLIC_BASE_URL ?? "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !parsed) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: parsed.base,
    origin: parsed.origin,
  };
}
