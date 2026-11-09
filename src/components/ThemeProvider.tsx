"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const saved = (localStorage.getItem("aisubscr-theme") as Theme) || "system";
    setThemeState(saved);
    applyTheme(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const t = (localStorage.getItem("aisubscr-theme") as Theme) || "system";
      if (t === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function setTheme(t: Theme) {
    localStorage.setItem("aisubscr-theme", t);
    setThemeState(t);
    applyTheme(t);
  }

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
