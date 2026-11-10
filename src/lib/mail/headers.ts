import type { OutboundMail } from "./types";

function hasControlChar(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/** One line. CR, LF, and other controls become spaces so they cannot break a header. */
export function singleLine(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[ \t\f\v]+/g, " ").trim();
}

/** Reject addresses that could add Bcc/Cc when a mailer copies the value into a header. */
export function safeMailAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return null;
  if (hasControlChar(trimmed) || /\s/.test(trimmed)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function safeMailSubject(value: string): string | null {
  const cleaned = singleLine(value).slice(0, 200);
  return cleaned || null;
}

/** Drop unsafe recipients. Subjects lose control characters instead of gaining headers. */
export function prepareOutbound(mail: OutboundMail): OutboundMail | null {
  const to = safeMailAddress(mail.to);
  const subject = safeMailSubject(mail.subject);
  if (!to || !subject) return null;
  return { ...mail, to, subject };
}
