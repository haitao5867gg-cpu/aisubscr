import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { formatDay, renewalDate } from "@/lib/renewal";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { AccountFrame } from "@/components/AccountFrame";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.accountTitle, description: t.seo.accountDescription, path: "/account", index: false });
}

export default async function AccountPage() {
  const zh = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login?next=/account");

  const [orders, tickets] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ticket.findMany({
      where: { userId: session.userId },
      include: { order: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const active = orders.filter((order) => order.status === "PENDING" || order.status === "PAID");
  const renewals = orders
    .map((order) => ({ order, date: renewalDate(order) }))
    .filter((entry): entry is { order: (typeof orders)[number]; date: Date } => Boolean(entry.date));

  return (
    <AccountFrame current="home">
      <div>
        <p className="eyebrow">{zh.nav.account}</p>
        <h1 className="page-title">
          {zh.shop.accountHello}，{session.name || session.email}
        </h1>
        <p className="page-desc">{session.email}</p>
        <Link href="/account/security" className="btn btn-secondary">{zh.security.security}</Link>
      </div>

      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{zh.shop.activeOrders}</h2>
          <Link href="/orders" className="muted">
            {zh.shop.viewAll}
          </Link>
        </div>
        {!active.length && <EmptyState title={zh.shop.noActive} href="/products" action={zh.shop.emptyCta} />}
        {active.length > 0 && (
          <div className="card">
            {active.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="ledger-row">
                <strong>{order.orderNo}</strong>
                <span className="muted">{order.items.map((item) => item.productName).join("、")}</span>
                <span>{formatRmb(order.totalCents)}</span>
                <StatusBadge status={order.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{zh.shop.renewalDates}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {zh.shop.renewalNote}
        </p>
        {!renewals.length && <EmptyState title={zh.shop.noRenewal} />}
        {renewals.length > 0 && (
          <div className="card">
            {renewals.map(({ order, date }) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="ledger-row">
                <strong>{order.items.filter((item) => item.isSubscription).map((item) => item.productName).join("、")}</strong>
                <span className="muted">{order.orderNo}</span>
                <span className="muted">{zh.shop.nextRenewal}</span>
                <strong>{formatDay(date)}</strong>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{zh.shop.myTickets}</h2>
          <Link href="/tickets" className="muted">
            {zh.shop.viewAll}
          </Link>
        </div>
        {!tickets.length && <EmptyState title={zh.shop.noTickets} href="/tickets/new" action={zh.ticket.newTicket} />}
        {tickets.length > 0 && (
          <div className="card">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="ledger-row">
                <strong>{ticket.subject}</strong>
                <span className="muted">
                  {ticket.order ? `${zh.shop.orderRef} ${ticket.order.orderNo}` : zh.ticket.categories[ticket.category as keyof typeof zh.ticket.categories]}
                </span>
                <span />
                <StatusBadge status={ticket.status} kind="ticket" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AccountFrame>
  );
}
