"use client";

import { createContext, useContext } from "react";
import { getDict, type Dict, type Locale } from "@/i18n";

const LocaleContext = createContext<Locale>("zh");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useDict(): Dict {
  return getDict(useContext(LocaleContext));
}
