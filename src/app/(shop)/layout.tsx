import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SupportFab } from "@/components/SupportFab";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";

// Layout always reads the database (and the header reads the session).
// Login/register have no page-level dynamic flag, so without this Next
// prerenders them at build time and fails when SQLite is not yet created.
export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, t] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { id: "default" } }),
    getLocale().then((locale) => getDict(locale)),
  ]);
  return (
    <>
      <a className="skip-link" href="#main">
        {t.common.skipToContent}
      </a>
      <Header />
      <AnnouncementBanner />
      <main id="main" className="container main-pad" style={{ paddingTop: "1.75rem", minHeight: "70vh" }}>
        {children}
      </main>
      <Footer />
      <SupportFab
        supportEmail={settings?.supportEmail || "support@example.com"}
        supportHours={settings?.supportHours || "08:00–23:00"}
      />
    </>
  );
}
