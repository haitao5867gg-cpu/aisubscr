"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDict, type Locale } from "@/i18n";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<Locale>("zh");
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )aisubscr-locale=(en|zh)/);
    if (match?.[1] === "en") setLocale("en");
  }, []);
  const t = getDict(locale);
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"}>
      <body>
        <main className="container" style={{ padding: "4rem 1rem" }}>
          <div className="card empty-state" role="alert">
            <p className="eyebrow" style={{ margin: 0 }}>
              500
            </p>
            <h1 className="page-title">{t.common.errorTitle}</h1>
            <p className="muted">{t.common.errorBody}</p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => reset()}>
                {t.common.retry}
              </button>
              <Link href="/" className="btn btn-secondary">
                {t.nav.home}
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
