import nodemailer from "nodemailer";
import { prepareOutbound } from "./headers";
import type { Mailer } from "./types";

export class MailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfigError";
  }
}

function flag(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new MailConfigError('SMTP_SECURE must be "true" or "false"');
}

export function createSmtpMailer(): Mailer {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.MAIL_FROM?.trim() ?? "";
  const secureFlag = flag(process.env.SMTP_SECURE);
  const secure = secureFlag ?? port === 465;

  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new MailConfigError("SMTP mailer requires SMTP_HOST and SMTP_PORT");
  }
  if (!from) {
    throw new MailConfigError("SMTP mailer requires MAIL_FROM");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return {
    name: "smtp",
    async send(mail) {
      const safe = prepareOutbound(mail);
      if (!safe) throw new Error("refusing mail with an unsafe recipient or subject");
      await transporter.sendMail({
        from,
        to: safe.to,
        subject: safe.subject,
        text: safe.text,
        html: safe.html,
      });
    },
  };
}
