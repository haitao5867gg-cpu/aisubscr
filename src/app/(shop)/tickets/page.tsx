import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { AccountFrame } from "@/components/AccountFrame";
import { EmptyState } from "@/components/EmptyState";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.ticketsTitle, description: t.seo.ticketsDescription, path: "/tickets", index: false });
}

function categoryLabel(t: ReturnType<typeof getDict>, category: string) {
  const labels = t.ticket.categories as Record<string, string>;
  return labels[category] || category;
}

export default async function TicketsPage() {
  const zh = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login?next=/tickets");
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.userId },
    include: { order: { select: { orderNo: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <AccountFrame current="tickets">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">{zh.ticket.title}</h1>
          <p className="page-desc">{zh.ticket.lead}</p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary">{zh.ticket.newTicket}</Link>
      </div>
      {!tickets.length && <EmptyState title={zh.shop.noTickets} href="/tickets/new" action={zh.ticket.newTicket} />}
      {tickets.length > 0 && (
        <div className="card">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="ledger-row">
              <strong>{ticket.subject}</strong>
              <span className="muted">
                {categoryLabel(zh, ticket.category)}
                {ticket.order ? ` · ${zh.shop.orderRef} ${ticket.order.orderNo}` : ""}
              </span>
              <time className="muted" dateTime={ticket.updatedAt.toISOString()}>{ticket.updatedAt.toISOString().slice(0, 10)}</time>
              <StatusBadge status={ticket.status} kind="ticket" />
            </Link>
          ))}
        </div>
      )}
    </AccountFrame>
  );
}
