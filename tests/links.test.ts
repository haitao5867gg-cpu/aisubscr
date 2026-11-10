import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import nextConfig from "../next.config";

const root = path.resolve(__dirname, "..");
const asset = /\.(png|svg|ico|jpg|jpeg|webp|gif|txt|xml|webmanifest)$/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function routesFromApp() {
  const routes: string[] = [];
  for (const file of walk(path.join(root, "src/app"))) {
    if (!file.endsWith(`${path.sep}page.tsx`) && !file.endsWith(`${path.sep}route.ts`)) continue;
    const rel = path.relative(path.join(root, "src/app"), path.dirname(file));
    const parts = rel.split(path.sep).filter((part) => part && part !== "." && !part.startsWith("("));
    const url = `/${parts.map((part) => (part.startsWith("[") ? `:${part.slice(1, -1)}` : part)).join("/")}`.replace(/\/$/, "") || "/";
    routes.push(url);
  }
  return routes;
}

function matches(pathname: string, patterns: string[]) {
  const segs = pathname.split("/").filter(Boolean);
  return patterns.some((pattern) => {
    const expected = pattern.split("/").filter(Boolean);
    if (expected.length !== segs.length) return false;
    return expected.every((seg, index) => seg.startsWith(":") || seg === segs[index]);
  });
}

function collectTargets(source: string) {
  const targets: string[] = [];
  const lines = source.split("\n");
  for (const line of lines) {
    if (!/\b(href|fetch|redirect|push|location|path)\b/.test(line)) continue;
    const found = [
      ...line.matchAll(/"(\/[^"]*)"/g),
      ...line.matchAll(/'(\/[^']*)'/g),
      ...line.matchAll(/`(\/[^`]*)`/g),
    ];
    for (const match of found) targets.push(match[1]);
  }
  return targets;
}

function pathnameOf(raw: string) {
  const withPlaceholders = raw.replace(/\$\{[^}]+\}/g, "x");
  const pathOnly = withPlaceholders.split("?")[0]?.split("#")[0] ?? "";
  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) return null;
  if (pathOnly.includes("*") || pathOnly.includes("(") || asset.test(pathOnly)) return null;
  return pathOnly.length > 1 ? pathOnly.replace(/\/$/, "") : "/";
}

it("keeps internal links on real routes or redirects", async () => {
  const pagesAndApis = routesFromApp();
  if (!nextConfig.redirects) throw new Error("next.config is missing redirects");
  const redirects = await nextConfig.redirects();
  const redirectSources = redirects.map((rule) => rule.source);
  expect(redirects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: "/plans", destination: "/products" }),
      expect.objectContaining({ source: "/plans/:id", destination: "/products/:id" }),
    ]),
  );
  for (const rule of redirects) {
    const destination = pathnameOf(rule.destination);
    expect(destination, rule.source).toBeTruthy();
    expect(matches(destination as string, pagesAndApis), rule.destination).toBe(true);
  }

  const missing: string[] = [];
  for (const file of walk(path.join(root, "src"))) {
    if (file.endsWith(`${path.sep}middleware.ts`) || file.endsWith(`${path.sep}robots.ts`)) continue;
    const relative = path.relative(root, file);
    for (const raw of collectTargets(readFileSync(file, "utf8"))) {
      const pathname = pathnameOf(raw);
      if (!pathname) continue;
      const ok = matches(pathname, pagesAndApis) || matches(pathname, redirectSources);
      if (!ok) missing.push(`${relative} -> ${raw}`);
    }
  }
  expect(missing).toEqual([]);
});
