import { expect, it } from "vitest";
import { en, zh } from "@/i18n";

function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => paths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

it("gives English every key the Chinese dictionary has", () => {
  expect(paths(en).sort()).toEqual(paths(zh).sort());
});
