import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isQrMime } from "@/lib/site-settings";

export async function GET() {
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings?.qrImageData || !settings.qrImageMime || !isQrMime(settings.qrImageMime)) {
    return new NextResponse(null, { status: 404 });
  }
  const bytes = Buffer.from(settings.qrImageData, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": settings.qrImageMime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
