import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { refreshPublic } from "@/lib/public-content";
import { prisma } from "@/lib/db";
import { isAllowedImageReference } from "@/lib/image-ref";
import { adminSettingsView, decodeQrImage, type SettingsRow } from "@/lib/site-settings";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

const schema = z.object({
  siteName: z.string().trim().min(1).max(80).optional(),
  supportEmail: z.string().trim().email().optional(),
  supportHours: z.string().trim().min(1).max(80).optional(),
  footerText: z.string().trim().min(1).max(500).optional(),
  wechatId: z.string().trim().max(64).optional(),
  qq: z.string().trim().max(20).optional(),
  contactEmail: z.string().trim().max(120).optional(),
  announcementText: z.string().trim().max(280).optional(),
  announcementEnabled: z.boolean().optional(),
  orderExpireMinutes: z.number().int().min(1).max(24 * 60).optional(),
  adminTotpRequired: z.boolean().optional(),
  adminNotifyEmail: z.string().trim().max(120).optional(),
  notifyPaidOrders: z.boolean().optional(),
  notifyNewTickets: z.boolean().optional(),
  notifyLowStock: z.boolean().optional(),
  qrImageUrl: z.string().trim().min(1).max(500).optional(),
  qrImageMime: z.enum(["image/png", "image/jpeg", "image/webp"]).nullable().optional(),
  qrImageBase64: z.string().max(800_000).nullable().optional(),
  clearQr: z.boolean().optional(),
});

function snapshot(row: SettingsRow) {
  return adminSettingsView(row);
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  let settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings) settings = await prisma.siteSetting.create({ data: { id: "default" } });
  return NextResponse.json({ settings: adminSettingsView(settings) });
}

export async function PATCH(req: NextRequest) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.admin.invalidSettings }, { status: 400 });
  if (parsed.data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.contactEmail)) {
    return NextResponse.json({ error: t.auth.emailInvalid }, { status: 400 });
  }
  if (parsed.data.adminNotifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.adminNotifyEmail)) {
    return NextResponse.json({ error: t.auth.emailInvalid }, { status: 400 });
  }
  const data: {
    siteName?: string;
    supportEmail?: string;
    supportHours?: string;
    footerText?: string;
    wechatId?: string;
    qq?: string;
    contactEmail?: string;
    announcementText?: string;
    announcementEnabled?: boolean;
    orderExpireMinutes?: number;
    adminTotpRequired?: boolean;
    adminNotifyEmail?: string;
    notifyPaidOrders?: boolean;
    notifyNewTickets?: boolean;
    notifyLowStock?: boolean;
    qrImageUrl?: string | null;
    qrImageMime?: string | null;
    qrImageData?: string | null;
  } = {};
  const fields = [
    "siteName",
    "supportEmail",
    "supportHours",
    "footerText",
    "wechatId",
    "qq",
    "contactEmail",
    "announcementText",
    "announcementEnabled",
    "orderExpireMinutes",
    "adminTotpRequired",
    "adminNotifyEmail",
    "notifyPaidOrders",
    "notifyNewTickets",
    "notifyLowStock",
  ] as const;
  for (const key of fields) {
    const value = parsed.data[key];
    if (value !== undefined) (data as Record<string, string | number | boolean | null>)[key] = value;
  }
  if (parsed.data.clearQr) {
    data.qrImageMime = null;
    data.qrImageData = null;
    data.qrImageUrl = null;
  } else if (parsed.data.qrImageUrl) {
    if (!isAllowedImageReference(parsed.data.qrImageUrl)) {
      return NextResponse.json({ error: t.admin.uploadInvalid }, { status: 400 });
    }
    data.qrImageUrl = parsed.data.qrImageUrl;
    data.qrImageMime = null;
    data.qrImageData = null;
  } else if (parsed.data.qrImageBase64 && parsed.data.qrImageMime) {
    const image = decodeQrImage(parsed.data.qrImageMime, parsed.data.qrImageBase64);
    if (!image) return NextResponse.json({ error: t.admin.invalidQr }, { status: 400 });
    data.qrImageMime = image.mime;
    data.qrImageData = image.data;
  }
  const before = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const actor = actorFrom(session);
  const settings = await prisma.$transaction(async (tx) => {
    const saved = await tx.siteSetting.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });
    await writeAudit(tx, {
      ...actor,
      action: "settings.update",
      targetType: "settings",
      targetId: "default",
      before: before ? snapshot(before) : null,
      after: snapshot(saved),
    });
    return saved;
  });
  refreshPublic("settings");
  return NextResponse.json({ settings: adminSettingsView(settings) });
}
