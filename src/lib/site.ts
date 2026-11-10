/** Public origin used for canonical URLs, Open Graph, and the sitemap. */
export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aisubscr.com";
  return raw.replace(/\/$/, "");
}
