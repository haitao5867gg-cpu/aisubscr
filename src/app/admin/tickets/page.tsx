import Link from "next/link";
import { prisma } from "@/lib/db";
import { adminTicketWhere, readTicketFilters } from "@/lib/admin-tickets";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/session";
import { TICKET_CATEGORIES, TICKET_STATUSES } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const zh = getDict(await getLocale());
  const session = await getSession();
  const filters = readTicketFilters(await searchParams, session.userId);
  const tickets = await prisma.ticket.findMany({
    where: adminTicketWhere(filters),
    include: {
      user: { select: { email: true } },
      assignee: { select: { email: true, name: true } },
      order: { select: { orderNo: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const assigneeValue = filters.assignee === session.userId ? "me" : filters.assignee ?? "";

  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.tickets}</h1>
      <form className="card filter-bar" method="get">
        <div>
          <label className="label" htmlFor="ticket-q">{zh.admin.ticketQuery}</label>
          <input id="ticket-q" className="input" name="q" defaultValue={filters.q ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="ticket-filter-status">{zh.admin.filterStatus}</label>
          <select id="ticket-filter-status" className="select" name="status" defaultValue={filters.status ?? ""}>
            <option value="">{zh.admin.allStatuses}</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>{zh.ticket.status[status]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ticket-filter-category">{zh.ticket.category}</label>
          <select id="ticket-filter-category" className="select" name="category" defaultValue={filters.category ?? ""}>
            <option value="">{zh.admin.allCategories}</option>
            {TICKET_CATEGORIES.map((category) => (
              <option key={category} value={category}>{zh.ticket.categories[category]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ticket-filter-assignee">{zh.ticket.assignee}</label>
          <select id="ticket-filter-assignee" className="select" name="assignee" defaultValue={assigneeValue}>
            <option value="">{zh.admin.allAssignees}</option>
            <option value="me">{zh.ticket.mine}</option>
            <option value="none">{zh.ticket.unassigned}</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit">{zh.admin.apply}</button>
      </form>
      {!tickets.length && <p className="muted">{zh.admin.empty}</p>}
      {tickets.length > 0 && (
        <div className="card">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} className="ledger-row">
              <strong>{ticket.subject}</strong>
              <span className="muted">
                {ticket.user.email}
                {ticket.order ? ` · ${ticket.order.orderNo}` : ""}
                {" · "}
                {ticket.assignee ? ticket.assignee.name || ticket.assignee.email : zh.ticket.unassigned}
              </span>
              <span className="muted">{zh.ticket.categories[ticket.category as keyof typeof zh.ticket.categories] || ticket.category}</span>
              <StatusBadge status={ticket.status} kind="ticket" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
