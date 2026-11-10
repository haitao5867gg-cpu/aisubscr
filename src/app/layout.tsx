import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { siteUrl } from "@/lib/site";
import "./globals.css";

// Nonce-based CSP is minted per request. A static shell would ship scripts
// without that nonce and the browser would block them.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b6fe0",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: `${t.siteName} — ${t.seo.homeTitle}`,
      template: `%s · ${t.siteName}`,
    },
    description: t.seo.homeDescription,
    applicationName: t.siteName,
    openGraph: {
      type: "website",
      siteName: t.siteName,
      locale: locale === "en" ? "en_US" : "zh_CN",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: t.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/og.png"],
    },
    robots: { index: true, follow: true },
  };
}

const themeBoot = `(function(){try{var t=localStorage.getItem("aisubscr-theme")||"system";var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} suppressHydrationWarning>
      <body>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <LocaleProvider locale={locale}>
          <ThemeProvider>
            <AnalyticsBeacon />
            {children}
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
