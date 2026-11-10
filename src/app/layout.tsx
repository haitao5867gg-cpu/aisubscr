import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "aisubscr — 数字商品商城",
    template: "%s · aisubscr",
  },
  description: "人民币标价的数字商品与订阅示例商城。模拟微信支付与支付宝，订单可分享，售后跟在订单上。",
  applicationName: "aisubscr",
  openGraph: {
    type: "website",
    siteName: "aisubscr",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "aisubscr" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

const themeBoot = `(function(){try{var t=localStorage.getItem("aisubscr-theme")||"system";var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} suppressHydrationWarning>
      <body>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <LocaleProvider locale={locale}>
          <ThemeProvider>{children}</ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
