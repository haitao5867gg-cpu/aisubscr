const SECRET_KEYS = [
  "SESSION_SECRET",
  "SMTP_PASS",
  "SMTP_USER",
  "PAYMENT_WEBHOOK_SECRET",
  "WECHAT_PAY_API_V3_KEY",
  "WECHAT_PAY_PRIVATE_KEY",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
] as const;

/** One journal line. Secrets and sqlite URLs are stripped before the line is written. */
export function redact(text: string) {
  let out = text;
  for (const key of SECRET_KEYS) {
    const secret = process.env[key];
    if (secret && secret.length >= 4) out = out.split(secret).join("[redacted]");
  }
  out = out.replace(/file:\S+/g, "file:[redacted]");
  return out.replace(/[\r\n]+/g, " ").slice(0, 400);
}

export function requestIdFrom(headers: Headers | Record<string, string | string[] | undefined>) {
  let raw = "";
  if (typeof (headers as Headers).get === "function") {
    raw = (headers as Headers).get("x-request-id") ?? "";
  } else {
    const record = headers as Record<string, string | string[] | undefined>;
    const value = record["x-request-id"] ?? record["X-Request-Id"];
    raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  }
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(trimmed)) return trimmed;
  return crypto.randomUUID();
}

export type ApiErrorLog = {
  requestId: string;
  route: string;
  status: number;
  error?: unknown;
};

/**
 * One JSON object on stderr so `journalctl -u aisubscr` shows request id, route, and status.
 * The line does not include passwords, reset codes, or mail credentials.
 */
export function logApiError(fields: ApiErrorLog) {
  const error =
    fields.error instanceof Error
      ? { name: fields.error.name, message: redact(fields.error.message || fields.error.name) }
      : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      requestId: fields.requestId,
      route: fields.route,
      status: fields.status,
      ...(error ? { error } : {}),
    }),
  );
}
