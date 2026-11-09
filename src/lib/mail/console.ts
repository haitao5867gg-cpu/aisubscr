import type { Mailer, OutboundMail } from "./types";

/** Server-log mailer. The message (including the reset code) is not emailed. */
export const consoleMailer: Mailer = {
  name: "console",
  async send(mail: OutboundMail) {
    console.info(
      `AISUBSCR_MAIL_CONSOLE ${JSON.stringify({
        provider: "console",
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      })}`,
    );
  },
};
