import { randomUUID } from "crypto";
import type { Dict } from "@/i18n";
import { getT } from "@/i18n/server";
import { formatRmb } from "../money";
import { logApiError } from "../server-log";
import { getMailer } from "./index";
import { mailDocument, paragraph } from "./template";
import type { OutboundMail } from "./types";

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

type Notice = Omit<OutboundMail, "to">;

export function orderPaidNotice(
  input: {
    orderNo: string;
    totalCents: number;
    items: { productName: string; quantity: number }[];
  },
  t: Dict,
): Notice {
  const amount = formatRmb(input.totalCents);
  const items = input.items.map((item) => `${item.productName} × ${item.quantity}`).join("、");
  const lines = [
    fill(t.mail.paidBody, { orderNo: input.orderNo }),
    fill(t.mail.paidAmount, { amount }),
    fill(t.mail.paidItems, { items }),
    t.mail.paidNote,
  ];
  return {
    subject: t.mail.paidSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.paidTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

export function passwordChangedNotice(t: Dict): Notice {
  const lines = [t.mail.passwordBody, t.mail.passwordWarn];
  return {
    subject: t.mail.passwordSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.passwordTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

export function emailChangedNotice(input: { oldEmail: string; newEmail: string }, t: Dict): Notice {
  const lines = [fill(t.mail.emailBody, input), t.mail.emailWarn];
  return {
    subject: t.mail.emailSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.emailTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

export function emailChangeCodeNotice(code: string, t: Dict): Notice {
  const lines = [fill(t.mail.resetCode, { code }), t.mail.resetExpire];
  return {
    subject: t.mail.emailCodeSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.emailCodeTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

/** Notices must not fail the action that triggered them. */
export async function deliverQuietly(mail: OutboundMail, route: string) {
  try {
    const mailer = getMailer();
    await mailer.send(mail);
    if (mailer.name === "smtp") {
      console.info(`[aisubscr mail] sent route=${route} to=${mail.to}`);
    }
  } catch (error) {
    logApiError({
      requestId: randomUUID(),
      route,
      status: 500,
      error,
    });
  }
}

export async function deliverPasswordChanged(to: string) {
  const t = await getT();
  await deliverQuietly({ to, ...passwordChangedNotice(t) }, "mail:password-changed");
}

export async function deliverEmailChanged(oldEmail: string, newEmail: string) {
  const t = await getT();
  await deliverQuietly(
    { to: oldEmail, ...emailChangedNotice({ oldEmail, newEmail }, t) },
    "mail:email-changed",
  );
}

export async function deliverOrderPaid(input: {
  to: string;
  orderNo: string;
  totalCents: number;
  items: { productName: string; quantity: number }[];
}) {
  const t = await getT();
  await deliverQuietly(
    {
      to: input.to,
      ...orderPaidNotice(input, t),
    },
    "mail:order-paid",
  );
}
