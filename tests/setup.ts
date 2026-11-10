import { beforeEach, vi } from "vitest";
import { resetCookieJar } from "./cookie-jar";

vi.mock("next/headers", async () => {
  const { cookieJar } = await import("./cookie-jar");
  return {
    cookies: async () => ({
      get(name: string) {
        const value = cookieJar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      getAll() {
        return [...cookieJar.entries()].map(([name, value]) => ({ name, value }));
      },
      set(name: string, value: string) {
        if (value === "") cookieJar.delete(name);
        else cookieJar.set(name, value);
      },
      delete(name: string) {
        cookieJar.delete(name);
      },
    }),
    headers: async () => new Headers(),
  };
});

beforeEach(() => {
  resetCookieJar();
});
