export const TICKET_CATEGORIES = ["order", "billing", "account", "technical", "other"] as const;
export const TICKET_STATUSES = ["OPEN", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const MAX_TICKET_ATTACHMENTS = 4;

const UPLOAD_URL = /^\/api\/tickets\/uploads\/([a-z0-9]{8,40})$/;

export function isTicketCategory(value: string): value is TicketCategory {
  return (TICKET_CATEGORIES as readonly string[]).includes(value);
}

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

/**
 * Ids returned by POST /api/uploads. A public ticket image address is
 * not accepted: another customer must not attach someone else's screenshot.
 */
export function parseTicketUploadIds(values: string[] | undefined): string[] | null {
  if (!values?.length) return [];
  if (values.length > MAX_TICKET_ATTACHMENTS) return null;
  const ids: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") return null;
    const match = UPLOAD_URL.exec(value);
    if (!match) return null;
    ids.push(match[1]);
  }
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

/** Browser URL for a saved screenshot. The handler checks the ticket owner or an admin. */
export function presentAttachment(item: { id: string }) {
  return { id: item.id, url: `/api/tickets/attachments/${item.id}` };
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
        attachments: (reply.attachments ?? []).map((item) => presentAttachment(item)),
      })),
  };
}
