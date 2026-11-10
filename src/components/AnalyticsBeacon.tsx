"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Same-origin page-view beacon. It posts only the path and referrer.
 * The server hashes a daily visitor id and does not store the IP.
 * Admin pages are skipped. No third-party script is loaded.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const body = JSON.stringify({ path: pathname, referrer: document.referrer || "" });
    void fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }, [pathname]);
  return null;
}
