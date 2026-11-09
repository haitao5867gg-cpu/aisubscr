import { prisma } from "@/lib/db";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  let settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings) settings = await prisma.siteSetting.create({ data: { id: "default" } });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.settings}</h1>
      <p className="page-desc">页头站点名、页脚客服邮箱与服务时间可在此修改。</p>
      <AdminSettingsForm
        initial={{
          siteName: settings.siteName,
          supportEmail: settings.supportEmail,
          supportHours: settings.supportHours,
          footerText: settings.footerText,
        }}
      />
    </div>
  );
}
