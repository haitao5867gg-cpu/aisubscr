import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actorFrom, writeAudit } from "@/lib/audit";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
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

function settingSnapshot(row: {
  siteName: string;
  supportEmail: string;
  supportHours: string;
  footerText: string;
}) {
  return {
    siteName: row.siteName,
    supportEmail: row.supportEmail,
    supportHours: row.supportHours,
    footerText: row.footerText,
  };
}

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请检查站点设置" }, { status: 400 });
  const before = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const actor = actorFrom(session);
  const settings = await prisma.$transaction(async (tx) => {
    const saved = await tx.siteSetting.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: { id: "default", ...parsed.data },
    });
    await writeAudit(tx, {
      ...actor,
      action: "settings.update",
      targetType: "settings",
      targetId: "default",
      before: before ? settingSnapshot(before) : null,
      after: settingSnapshot(saved),
    });
    return saved;
  });
  return NextResponse.json({ settings });
}
