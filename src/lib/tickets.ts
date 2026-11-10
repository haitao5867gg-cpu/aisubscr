import { r2PublicBaseUrl } from "./r2-config";
import { isAllowedImageReference } from "./image-ref";

export const TICKET_CATEGORIES = ["order", "billing", "account", "technical", "other"] as const;
export const TICKET_STATUSES = ["OPEN", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const MAX_TICKET_ATTACHMENTS = 4;

const TICKET_FILE =
  /^tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isTicketCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

/** A WebP produced by the ticket upload pipeline, on this host or the configured R2 base. */
export function isTicketImageUrl(value: string) {
  if (!isAllowedImageReference(value)) return false;
  if (value.startsWith("/uploads/")) return TICKET_FILE.test(value.slice("/uploads/".length));
  const base = r2PublicBaseUrl();
  if (!base || !value.startsWith(`${base}/`)) return false;
  return TICKET_FILE.test(value.slice(base.length + 1));
}

export function parseTicketAttachments(values: string[] | undefined): string[] | null {
  if (!values?.length) return [];
  if (values.length > MAX_TICKET_ATTACHMENTS) return null;
  const urls: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !isTicketImageUrl(value)) return null;
    urls.push(value);
  }
  return urls;
}

/** Replies a customer or the public order page is allowed to see. */
export const customerReplies = {
  where: { internal: false },
  orderBy: { createdAt: "asc" as const },
  include: { attachments: { orderBy: { createdAt: "asc" as const } } },
};

type ReplyRow = {
  id: string;
  body: string;
  isStaff: boolean;
  internal: boolean;
  createdAt: Date;
  attachments?: { id: string; url: string }[];
};

type TicketRow = {
  id: string;
  subject: string;
  category: string;
  status: string;
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  order?: { id: string; orderNo: string } | null;
  replies?: ReplyRow[];
};

/** Drop internal notes before a ticket leaves the server for a customer. */
export function customerTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    orderId: ticket.orderId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    order: ticket.order ? { id: ticket.order.id, orderNo: ticket.order.orderNo } : null,
    replies: (ticket.replies ?? [])
      .filter((reply) => !reply.internal)
      .map((reply) => ({
        id: reply.id,
        body: reply.body,
        isStaff: reply.isStaff,
        createdAt: reply.createdAt,
        attachments: (reply.attachments ?? []).map((item) => ({ id: item.id, url: item.url })),
      })),
  };
}
