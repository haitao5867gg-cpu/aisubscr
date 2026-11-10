import { en, zh } from "@/i18n";
import { getT } from "@/i18n/server";
import { consoleMailer } from "./console";
import { createSmtpMailer, MailConfigError } from "./smtp";
import type { Mailer, MailProviderName } from "./types";

export { MailConfigError } from "./smtp";
export type { Mailer, MailProviderName, OutboundMail } from "./types";

/**
 * MAIL_PROVIDER=console logs the message. MAIL_PROVIDER=smtp sends via SMTP.
 * When MAIL_PROVIDER is unset, SMTP is used only if SMTP_HOST is set; otherwise
 * the console provider is used and no email is sent.
 * An SMTP failure is never replaced by the console provider.
 */
export function resolveMailProviderName(): MailProviderName {
  const raw = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "console" || raw === "smtp") return raw;
  if (raw === "") return process.env.SMTP_HOST?.trim() ? "smtp" : "console";
  throw new MailConfigError('MAIL_PROVIDER must be "console" or "smtp"');
}

export function getMailer(): Mailer {
  const name = resolveMailProviderName();
  if (name === "console") return consoleMailer;
  return createSmtpMailer();
}

function fill(template: string, code: string) {
  return template.replaceAll("{code}", code);
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const mailer = getMailer();
  const t = await getT();
  await mailer.send({
    to,
    subject: t.mail.resetSubject,
    text: [
      fill(zh.mail.resetCode, code),
      zh.mail.resetExpire,
      "",
      fill(en.mail.resetCodeEn, code),
      en.mail.resetExpireEn,
    ].join("\n"),
  });
  if (mailer.name === "smtp") {
    console.info(`[aisubscr mail] sent password reset via smtp to=${to}`);
  }
}
