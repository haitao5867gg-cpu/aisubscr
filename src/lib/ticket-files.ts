import type { Prisma } from "@prisma/client";
import { openUpload, type OpenedUpload } from "./serve-upload";

export class TicketAttachmentError extends Error {
  constructor() {
    super("BAD_ATTACHMENTS");
    this.name = "TicketAttachmentError";
  }
}

const TICKET_KEY =
  /^tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/**
 * Storage key for a ticket screenshot. Accepts the key itself, a legacy
 * uploads URL that ends in tickets/<uuid>.webp, or the same key on an R2 URL.
 * The bytes are only read from local disk, after an ownership check.
 */
export function ticketStorageKey(stored: string): string | null {
  const value = stored.trim();
  if (TICKET_KEY.test(value)) return value;
  const marker = "/tickets/";
  const at = value.lastIndexOf(marker);
  if (at < 0) return null;
  const key = `tickets/${value.slice(at + marker.length)}`;
  const bare = key.split("?")[0]?.split("#")[0] ?? "";
  return TICKET_KEY.test(bare) ? bare : null;
}

export async function openTicketFile(stored: string): Promise<OpenedUpload | null> {
  const key = ticketStorageKey(stored);
  if (!key) return null;
  return openUpload(key.split("/"), { audience: "ticket" });
}

/** Copy owned uploads onto a reply, then delete the pending rows. */
export async function claimTicketUploads(
  tx: Prisma.TransactionClient,
  userId: string,
  ids: string[],
): Promise<string[] | null> {
  if (ids.length === 0) return [];
  if (new Set(ids).size !== ids.length) return null;
  const rows = await tx.ticketUpload.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, key: true },
  });
  if (rows.length !== ids.length) return null;
  const byId = new Map(rows.map((row) => [row.id, row.key]));
  const keys = ids.map((id) => byId.get(id));
  if (keys.some((key) => !key || !ticketStorageKey(key))) return null;
  const removed = await tx.ticketUpload.deleteMany({ where: { id: { in: ids }, userId } });
  if (removed.count !== ids.length) return null;
  return keys as string[];
}
