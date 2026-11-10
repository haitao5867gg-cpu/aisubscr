import { prisma } from "@/lib/db";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const zh = getDict(await getLocale());
  let settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings) settings = await prisma.siteSetting.create({ data: { id: "default" } });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.settings}</h1>
      <p className="page-desc">{zh.admin.settingsLead}</p>
      <AdminSettingsForm
        initial={{
          siteName: settings.siteName,
          supportEmail: settings.supportEmail,
          supportHours: settings.supportHours,
          footerText: settings.footerText,
          wechatId: settings.wechatId,
          qq: settings.qq,
          contactEmail: settings.contactEmail,
          announcementText: settings.announcementText,
          announcementEnabled: settings.announcementEnabled,
          orderExpireMinutes: settings.orderExpireMinutes,
          adminTotpRequired: settings.adminTotpRequired,
          qrImageUrl: settings.qrImageUrl || "",
          hasContactQr: Boolean(settings.qrImageUrl || (settings.qrImageData && settings.qrImageMime)),
        }}
      />
    </div>
  );
}
