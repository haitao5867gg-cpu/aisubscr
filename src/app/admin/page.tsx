import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { formatShanghai, shanghaiWindowStart, summarizeShop } from "@/lib/admin-stats";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const locale = await getLocale();
  const zh = getDict(locale);
  const since = shanghaiWindowStart(30);
  const [orders, users, recent, openTickets] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { paidAt: { gte: since } }] },
      select: { createdAt: true, paidAt: true, status: true, totalCents: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      include: { user: { select: { email: true } }, items: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "REPLIED"] } } }),
  ]);
  const summary = summarizeShop({ orders, users });
  const rangeLabel = {
    today: zh.admin.today,
    d7: zh.admin.days7,
    d30: zh.admin.days30,
  };
  const peak = Math.max(1, ...summary.chart.map((column) => column.orders));

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">{zh.admin.title}</h1>
        <p className="page-desc">{zh.admin.chartNote}</p>
      </div>
      <div className="stat-grid">
        {summary.ranges.map((range) => (
          <article key={range.key} className="card stat-card">
            <h2>{rangeLabel[range.key]}</h2>
            <p className="stat-num">
              {range.orders}
              <span>{zh.admin.orderCount}</span>
            </p>
            <p style={{ margin: "0.2rem 0 0" }}>
              {zh.admin.revenue} {formatRmb(range.revenueCents)}
            </p>
            <p className="muted" style={{ margin: "0.15rem 0 0" }}>
              {zh.admin.newUsers} {range.users}
            </p>
          </article>
        ))}
      </div>
      <section className="card chart-card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>{zh.admin.chartTitle}</h2>
        <div
          className="chart"
          role="img"
          aria-label={summary.chart.map((column) => `${column.label} ${column.orders}`).join("，")}
        >
          {summary.chart.map((column) => (
            <div key={column.day} className="chart-col">
              <strong>{column.orders}</strong>
              <div className="chart-bar" style={{ height: `${Math.max(8, Math.round((column.orders / peak) * 120))}px` }} />
              <span>{column.label}</span>
              <span>{formatRmb(column.revenueCents)}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ margin: "0.8rem 0 0" }}>
          <Link href="/admin/tickets">{zh.admin.openTickets}</Link> {openTickets}
        </p>
      </section>
      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{zh.admin.recentOrders}</h2>
          <Link href="/admin/orders" className="muted">{zh.shop.viewAll}</Link>
        </div>
        {!recent.length && <p className="muted">{zh.admin.empty}</p>}
        {recent.length > 0 && (
          <div className="card">
            {recent.map((order) => (
              <Link key={order.id} href={`/admin/orders/${order.id}`} className="ledger-row">
                <strong>{order.orderNo}</strong>
                <span className="muted">
                  {order.user.email} · {formatShanghai(order.createdAt, locale)}
                </span>
                <span>{formatRmb(order.totalCents)}</span>
                <StatusBadge status={order.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
