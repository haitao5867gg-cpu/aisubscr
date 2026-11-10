"use client";

import { useDict, useLocale } from "./LocaleProvider";

export function LanguageSwitch() {
  const locale = useLocale();
  const zh = useDict();

  function pick(next: "zh" | "en") {
    if (next === locale) return;
    document.cookie = `aisubscr-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem("aisubscr-locale", next);
    } catch {
      /* private mode */
    }
    window.location.reload();
  }

  return (
    <div className="lang-switch" role="group" aria-label={zh.common.language}>
      <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => pick("zh")} aria-pressed={locale === "zh"}>
        {zh.common.zhLabel}
      </button>
      <button type="button" className={locale === "en" ? "active" : ""} onClick={() => pick("en")} aria-pressed={locale === "en"}>
        {zh.common.enLabel}
      </button>
    </div>
  );
}
