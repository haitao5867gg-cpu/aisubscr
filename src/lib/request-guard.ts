import { NextRequest, NextResponse } from "next/server";

/** Ticket JSON is a short subject, a 4000-character body, and at most four upload ids. */
export const TICKET_JSON_MAX = 16 * 1024;

/** Beacon body is a path and a referrer. */
export const ANALYTICS_JSON_MAX = 2 * 1024;

const ALLOWED_FETCH_SITE = new Set(["same-origin", "same-site", "none"]);

/**
 * Mutating routes accept a missing Origin (server-side calls and tests) and a
 * browser request whose Origin host matches Host. A cross-site browser request
 * sends `Sec-Fetch-Site: cross-site` or a foreign Origin, and is rejected.
 * SameSite=Lax already withholds the cookie on cross-site POST; this is the
 * same check for routes that do not need a cookie, such as the analytics beacon.
 */
export function sameOriginMutation(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site")?.trim().toLowerCase() ?? "";
  if (site && !ALLOWED_FETCH_SITE.has(site)) return false;

  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const expected = new Set<string>();
  const host = req.headers.get("host")?.trim().toLowerCase();
  if (host) expected.add(host);
  const requestHost = req.nextUrl.host.trim().toLowerCase();
  if (requestHost) expected.add(requestHost);
  return expected.has(parsed.host.toLowerCase());
}

export function declaredBodyTooLarge(headers: Headers, maxBytes: number): boolean {
  const declared = headers.get("content-length");
  if (declared === null) return false;
  const value = declared.trim();
  if (!/^\d+$/.test(value)) return true;
  const size = Number(value);
  return !Number.isFinite(size) || size > maxBytes;
}

export async function readJsonLimited(
  req: NextRequest,
  maxBytes: number,
): Promise<{ value: unknown; tooLarge: boolean }> {
  if (declaredBodyTooLarge(req.headers, maxBytes)) return { value: null, tooLarge: true };
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { value: null, tooLarge: true };
  if (!text) return { value: null, tooLarge: false };
  try {
    return { value: JSON.parse(text) as unknown, tooLarge: false };
  } catch {
    return { value: null, tooLarge: false };
  }
}

export async function readMutationJson(
  req: NextRequest,
  maxBytes: number,
  forbiddenMessage: string,
  tooLargeMessage: string,
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  if (!sameOriginMutation(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: forbiddenMessage },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  const body = await readJsonLimited(req, maxBytes);
  if (body.tooLarge) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: tooLargeMessage },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { ok: true, value: body.value };
}
