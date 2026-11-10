import type { Prisma } from "@prisma/client";
import { isTicketCategory, isTicketStatus } from "./tickets";

export type TicketListFilters = {
  q?: string;
  status?: string;
  category?: string;
  assignee?: string;
};

function first(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export function readTicketFilters(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  viewerId?: string,
): TicketListFilters {
  const pick = (name: string) => {
    if (typeof (source as URLSearchParams).get === "function") {
      return (source as URLSearchParams).get(name)?.trim() ?? "";
    }
    return first((source as Record<string, string | string[] | undefined>)[name]);
  };
  const status = pick("status");
  const category = pick("category");
  const assignee = pick("assignee");
  let assigneeFilter: string | undefined;
  if (assignee === "me" && viewerId) assigneeFilter = viewerId;
  else if (assignee === "none" || assignee === "me" || assignee) assigneeFilter = assignee;
  return {
    q: pick("q").slice(0, 120) || undefined,
    status: status && isTicketStatus(status) ? status : undefined,
    category: category && isTicketCategory(category) ? category : undefined,
    assignee: assigneeFilter,
  };
}

export function adminTicketWhere(filters: TicketListFilters): Prisma.TicketWhereInput {
  const q = filters.q?.trim();
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.assignee === "none"
      ? { assigneeId: null }
      : filters.assignee
        ? { assigneeId: filters.assignee }
        : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q } },
            { user: { email: { contains: q.toLowerCase() } } },
            { order: { orderNo: { contains: q } } },
          ],
        }
      : {}),
  };
}
