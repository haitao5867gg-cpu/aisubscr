import { cookies } from "next/headers";
import { getDict, type Dict, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("aisubscr-locale")?.value;
  return value === "en" ? "en" : "zh";
}

export async function getT(): Promise<Dict> {
  return getDict(await getLocale());
}
