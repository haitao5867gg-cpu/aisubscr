"use client";

import { useEffect, useState } from "react";

/** Minimal 中文/English switch stored in localStorage for later i18n wiring */
export function LanguageSwitch() {
  const [locale, setLocale] = useState<"zh" | "en">("zh");
  useEffect(() => {
    const saved = (localStorage.getItem("aisubscr-locale") as "zh" | "en") || "zh";
    setLocale(saved);
    document.documentElement.lang = saved === "en" ? "en" : "zh-CN";
  }, []);

  function pick(next: "zh" | "en") {
    localStorage.setItem("aisubscr-locale", next);
    setLocale(next);
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    // Soft reload so server components can later read cookie/locale if wired
    window.dispatchEvent(new Event("aisubscr-locale"));
  }

  return (
    <div className="lang-switch" aria-label="Language">
      <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => pick("zh")} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", font: "inherit" }}>
        中文
      </button>
      <button type="button" className={locale === "en" ? "active" : ""} onClick={() => pick("en")} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", font: "inherit" }}>
        English
      </button>
    </div>
  );
}
