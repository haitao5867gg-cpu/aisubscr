import { randomUUID } from "crypto";
import type { Dict } from "@/i18n";
import { getT } from "@/i18n/server";
import { crossedLowStock } from "../admin-stats";
import { prisma } from "../db";
import { formatRmb } from "../money";
import { logApiError } from "../server-log";
import { siteUrl } from "../site";
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

export function ticketReplyNotice(
  input: { subject: string; excerpt: string; url: string },
  t: Dict,
): Notice {
  const lines = [
    fill(t.mail.ticketReplyBody, { subject: input.subject }),
    input.excerpt,
    fill(t.mail.ticketReplyLink, { url: input.url }),
  ];
  return {
    subject: t.mail.ticketReplySubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.ticketReplyTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

export function adminNewTicketNotice(
  input: { email: string; subject: string; category: string; url: string },
  t: Dict,
): Notice {
  const lines = [
    fill(t.mail.adminTicketBody, input),
    fill(t.mail.adminTicketLink, { url: input.url }),
  ];
  return {
    subject: t.mail.adminTicketSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.adminTicketTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

export type LowStockLine = { name: string; stock: number; threshold: number };

function lowStockLines(items: LowStockLine[], t: Dict) {
  if (!items.length) return [];
  return [
    t.mail.adminLowStockLead,
    ...items.map((item) =>
      fill(t.mail.adminLowStockItem, {
        name: item.name,
        stock: String(item.stock),
        threshold: String(item.threshold),
      }),
    ),
  ];
}

export function adminPaidOrderNotice(
  input: { orderNo: string; amount: string; email: string },
  t: Dict,
  lowStock: LowStockLine[] = [],
): Notice {
  const lines = [fill(t.mail.adminPaidBody, input), ...lowStockLines(lowStock, t)];
  return {
    subject: t.mail.adminPaidSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.adminPaidTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

/** Sent when paid-order mail is off and the low-stock toggle is still on. */
export function adminLowStockNotice(input: { orderNo: string; items: LowStockLine[] }, t: Dict): Notice {
  const lines = [fill(t.mail.adminLowStockBody, { orderNo: input.orderNo }), ...lowStockLines(input.items, t)];
  return {
    subject: t.mail.adminLowStockSubject,
    text: lines.join("\n"),
    html: mailDocument(t.mail.adminLowStockTitle, lines.map((line) => paragraph(line)).join(""), t.mail.footer),
  };
}

async function adminNotifyTarget(kind: "paid" | "ticket") {
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings) return null;
  const to = settings.adminNotifyEmail.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  if (kind === "paid" && !settings.notifyPaidOrders) return null;
  if (kind === "ticket" && !settings.notifyNewTickets) return null;
  return to;
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

export function mailExcerpt(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 400);
}

/** A failed send is logged and swallowed. Callers keep the ticket or the payment. */
export async function deliverTicketStaffReply(input: { to: string; subject: string; excerpt: string; ticketId: string }) {
  const t = await getT();
  await deliverQuietly(
    {
      to: input.to,
      ...ticketReplyNotice(
        { subject: input.subject, excerpt: input.excerpt, url: `${siteUrl()}/tickets/${input.ticketId}` },
        t,
      ),
    },
    "mail:ticket-reply",
  );
}

export async function deliverAdminNewTicket(input: { email: string; subject: string; category: string; ticketId: string }) {
  try {
    const to = await adminNotifyTarget("ticket");
    if (!to) return;
    const t = await getT();
    const category = t.ticket.categories[input.category as keyof typeof t.ticket.categories] || input.category;
    await deliverQuietly(
      {
        to,
        ...adminNewTicketNotice({ ...input, category, url: `${siteUrl()}/admin/tickets/${input.ticketId}` }, t),
      },
      "mail:admin-ticket",
    );
  } catch (error) {
    logApiError({ requestId: randomUUID(), route: "mail:admin-ticket", status: 500, error });
  }
}

/** Products on this order whose reserved stock crossed the per-product threshold. */
export async function lowStockAfterPayment(orderId: string): Promise<LowStockLine[]> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: {
      quantity: true,
      product: { select: { name: true, stock: true, lowStockThreshold: true } },
    },
  });
  const lines: LowStockLine[] = [];
  for (const item of items) {
    if (
      !crossedLowStock({
        stock: item.product.stock,
        quantity: item.quantity,
        threshold: item.product.lowStockThreshold,
      }) ||
      item.product.stock === null
    ) {
      continue;
    }
    lines.push({
      name: item.product.name,
      stock: item.product.stock,
      threshold: item.product.lowStockThreshold,
    });
  }
  return lines;
}

export async function deliverAdminPaidOrder(input: {
  email: string;
  orderNo: string;
  totalCents: number;
  lowStock?: LowStockLine[];
}) {
  try {
    const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
    if (!settings) return;
    const to = settings.adminNotifyEmail.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
    const lowStock = settings.notifyLowStock ? (input.lowStock ?? []) : [];
    if (!settings.notifyPaidOrders && lowStock.length === 0) return;
    const t = await getT();
    const notice = settings.notifyPaidOrders
      ? adminPaidOrderNotice(
          { orderNo: input.orderNo, amount: formatRmb(input.totalCents), email: input.email },
          t,
          lowStock,
        )
      : adminLowStockNotice({ orderNo: input.orderNo, items: lowStock }, t);
    await deliverQuietly({ to, ...notice }, settings.notifyPaidOrders ? "mail:admin-paid" : "mail:admin-low-stock");
  } catch (error) {
    logApiError({ requestId: randomUUID(), route: "mail:admin-paid", status: 500, error });
  }
}
