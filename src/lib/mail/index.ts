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

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const mailer = getMailer();
  await mailer.send({
    to,
    subject: "aisubscr 密码重置验证码",
    text: [
      `您的验证码是 ${code}`,
      "验证码 15 分钟内有效。如非本人操作，请忽略这封邮件。",
      "",
      `Your verification code is ${code}`,
      "It expires in 15 minutes. If you did not request a password reset, ignore this email.",
    ].join("\n"),
  });
  if (mailer.name === "smtp") {
    console.info(`[aisubscr mail] sent password reset via smtp to=${to}`);
  }
}
