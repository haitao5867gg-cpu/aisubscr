export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailProviderName = "console" | "smtp";

export interface Mailer {
  readonly name: MailProviderName;
  send(mail: OutboundMail): Promise<void>;
}
