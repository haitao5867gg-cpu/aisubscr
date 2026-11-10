import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { UPLOAD_CACHE_CONTROL, openUpload } from "@/lib/serve-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bytes for `/uploads/...`. `next start` only serves public files that existed
 * when the process booted, so new product and QR images would 404 until a
 * restart. next.config rewrites `/uploads/:path*` here before that check.
 * Middleware skips both paths so this response keeps a public cache.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const opened = await openUpload(Array.isArray(segments) ? segments : []);
  if (!opened) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  opened.stream.on("error", () => {
    opened.stream.destroy();
  });
  return new NextResponse(Readable.toWeb(opened.stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": opened.contentType,
      "Cache-Control": UPLOAD_CACHE_CONTROL,
      "CDN-Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
