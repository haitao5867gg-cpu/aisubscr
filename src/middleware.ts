import { NextRequest, NextResponse } from "next/server";
import { r2ImageOrigin } from "@/lib/r2-config";

/**
 * Per-request CSP nonce for Next.js inline/framework scripts.
 * Styles stay 'unsafe-inline': the shop renders React style attributes, and a
 * nonce on style-src would make browsers ignore 'unsafe-inline'.
 * HSTS and upgrade-insecure-requests are sent only on HTTPS requests so local
 * HTTP (`next dev` / `next start`) keeps working. nginx sets X-Forwarded-Proto.
 */
function requestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim() ?? "";
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function middleware(request: NextRequest) {
  const https =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";

  // Health checks are not HTML. They skip the CSP nonce (which is for pages)
  // and any limiter added in this middleware. Login, registration, and password
  // reset limits stay inside those routes and do not apply here.
  if (request.nextUrl.pathname === "/api/health") {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("CDN-Cache-Control", "no-store");
    if (https) {
      response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
    return response;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const id = requestId(request);

  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const imageOrigin = r2ImageOrigin();
  const imgSrc = ["'self'", "blob:", "data:", imageOrigin].filter(Boolean).join(" ");
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self'",
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    https ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", id);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", id);
  // HTML carries a per-request nonce and may include a session. Do not let
  // Cloudflare store it. Hashed /_next/static files and /uploads images are
  // excluded by the matcher and keep their public Cache-Control.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("CDN-Cache-Control", "no-store");
  if (https) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|uploads/|api/uploads/file/|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|og.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
