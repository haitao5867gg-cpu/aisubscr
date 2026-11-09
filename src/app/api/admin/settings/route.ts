import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  let settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings) settings = await prisma.siteSetting.create({ data: { id: "default" } });
  return NextResponse.json({ settings });
}

const schema = z.object({
  siteName: z.string().min(1).optional(),
  supportEmail: z.string().min(1).optional(),
  supportHours: z.string().min(1).optional(),
  footerText: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const body = schema.parse(await req.json());
  const settings = await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: body,
    create: { id: "default", ...body },
  });
  return NextResponse.json({ settings });
}
