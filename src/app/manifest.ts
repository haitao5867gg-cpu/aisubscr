import type { MetadataRoute } from "next";
import { getLocale, getT } from "@/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return {
    name: t.siteName,
    short_name: t.siteName,
    description: t.seo.homeDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#3b6fe0",
    lang: locale === "en" ? "en" : "zh-CN",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
