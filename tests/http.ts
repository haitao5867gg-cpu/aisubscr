import { readFileSync, writeFileSync } from "node:fs";
import { NextRequest } from "next/server";

const COUNTER = "/tmp/aisubscr-vitest/ip-counter";
const NETS = ["192.0.2", "198.51.100", "203.0.113"] as const;

/** Documentation ranges only, so the address is never treated as Cloudflare or a local proxy. */
export function nextIp() {
  let n = 0;
  try {
    n = Number(readFileSync(COUNTER, "utf8")) || 0;
  } catch {
    n = 0;
  }
  n += 1;
  writeFileSync(COUNTER, String(n));
  const net = NETS[Math.floor((n - 1) / 250) % NETS.length];
  const host = ((n - 1) % 250) + 1;
  return `${net}.${host}`;
}

export function jsonRequest(
  pathname: string,
  opts: { method?: string; body?: unknown; ip?: string; headers?: Record<string, string> } = {},
) {
  const ip = opts.ip ?? nextIp();
  const method = opts.method ?? (opts.body === undefined ? "GET" : "POST");
  const headers = new Headers();
  headers.set("x-real-ip", ip);
  headers.set("x-request-id", `testreq-${ip.replaceAll(".", "")}`);
  if (opts.headers) {
    for (const [key, value] of Object.entries(opts.headers)) headers.set(key, value);
  }
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://127.0.0.1${pathname}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}
