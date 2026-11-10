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

export default async function TicketsPage() {
  const zh = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login?next=/tickets");
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.userId },
    include: { order: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <AccountFrame current="tickets">
      <div>
        <h1 className="page-title">{zh.ticket.title}</h1>
        <p className="page-desc">{zh.shop.noTickets}</p>
      </div>
      {!tickets.length && <EmptyState title={zh.shop.noTickets} href="/orders" action={zh.nav.orders} />}
      {tickets.length > 0 && <div className="card">
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="ledger-row">
            <strong>{ticket.subject}</strong>
            <span className="muted">{zh.shop.orderRef} {ticket.order.orderNo}</span>
            <span className="muted">{ticket.createdAt.toISOString().slice(0, 10)}</span>
            <StatusBadge status={ticket.status} kind="ticket" />
          </Link>
        ))}
      </div>}
    </AccountFrame>
  );
}
