import { zh, type Dict } from "./zh";
import { en } from "./en";

const dictionaries = { zh, en } as const;
export type Locale = keyof typeof dictionaries;

export function getDict(locale: Locale = "zh"): Dict {
  return dictionaries[locale] ?? zh;
}

export { zh, en };
export type { Dict };
