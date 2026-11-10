import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

// Nonce-based CSP is minted per request. A static shell would ship scripts
// without that nonce and the browser would block them.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "aisubscr — 示例数字商品商城",
  description: "通用数字商品电商框架（本地演示）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
