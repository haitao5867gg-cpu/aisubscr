"use client";

import { useTheme } from "./ThemeProvider";
import { useDict } from "@/components/LocaleProvider";

export function ThemeToggle() {
  const zh = useDict();
  const { theme, setTheme } = useTheme();
  const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const label =
    theme === "system" ? zh.common.themeSystem : theme === "light" ? zh.common.themeLight : zh.common.themeDark;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      title={`${zh.common.theme}: ${label}`}
      aria-label={zh.common.theme}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻"}
    </button>
  );
}
