import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { RevenueChart } from "@/components/RevenueChart";
import {
  conversionFunnel,
  formatShanghai,
  lowStockList,
  rankTopProducts,
  REVENUE_STATUSES,
  shanghaiWindowStart,
  stepRate,
  summarizeShop,
} from "@/lib/admin-stats";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export default async function AdminHome() {
  const locale = await getLocale();
  const zh = getDict(locale);
  const since = shanghaiWindowStart(30);
  const [orders, users, recent, openTickets, sold, pageViews, checkouts, paidEvents, products] = await Promise.all([
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
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.orderItem.findMany({
      where: { order: { paidAt: { gte: since }, status: { in: [...REVENUE_STATUSES] } } },
      select: { productId: true, productName: true, unitPriceCents: true, quantity: true },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { visitorHash: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { kind: "checkout", createdAt: { gte: since } },
      select: { visitorHash: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { kind: "paid", createdAt: { gte: since } },
      select: { visitorHash: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true, stock: true, lowStockThreshold: true, active: true },
    }),
  ]);
  const summary = summarizeShop({ orders, users });
  const top = rankTopProducts(sold);
  const funnel = conversionFunnel({
    pageVisitors: pageViews.map((row) => row.visitorHash),
    checkoutVisitors: checkouts.map((row) => row.visitorHash),
    paidVisitors: paidEvents.map((row) => row.visitorHash),
  });
  const low = lowStockList(products);
  const rangeLabel = {
    today: zh.admin.today,
    d7: zh.admin.days7,
    d30: zh.admin.days30,
  };
  const chartLabel = summary.chart
    .map((column) => `${column.label} ${column.paidOrders} ${formatRmb(column.revenueCents)}`)
    .join(zh.common.listSep);
  const funnelSteps = [
    { key: "page", label: zh.admin.funnelPage, count: funnel.page, previous: null as number | null },
    { key: "checkout", label: zh.admin.funnelCheckout, count: funnel.checkout, previous: funnel.page },
    { key: "paid", label: zh.admin.funnelPaid, count: funnel.paid, previous: funnel.checkout },
  ];

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
              {range.paidOrders}
              <span>{zh.admin.paidOrders}</span>
            </p>
            <p style={{ margin: "0.2rem 0 0" }}>
              {zh.admin.revenue} {formatRmb(range.revenueCents)}
            </p>
            <p className="muted" style={{ margin: "0.15rem 0 0" }}>
              {zh.admin.newUsers} {range.users}
              {zh.common.listSep}
              {fill(zh.admin.placedOrders, { count: String(range.orders) })}
            </p>
          </article>
        ))}
      </div>
      <section className="card chart-card" aria-labelledby="revenue-chart-title">
        <h2 id="revenue-chart-title" style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>{zh.admin.chartTitle}</h2>
        <p className="muted" style={{ margin: "0 0 0.75rem" }}>{zh.admin.chartCaption}</p>
        <div className="chart-scroll">
          <RevenueChart
            columns={summary.chart}
            ariaLabel={`${zh.admin.chartTitle}${zh.common.colon}${chartLabel}`}
            paidLabel={zh.admin.paidOrders}
            revenueLabel={zh.admin.revenue}
          />
        </div>
        <p className="muted" style={{ margin: "0.8rem 0 0" }}>
          <Link href="/admin/tickets">{zh.admin.openTickets}</Link> {openTickets}
        </p>
      </section>
      <section className="stack" aria-labelledby="funnel-title">
        <div>
          <h2 id="funnel-title" style={{ margin: 0, fontSize: "1.05rem" }}>{zh.admin.funnel}</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>{zh.admin.funnelDashboardLead}</p>
        </div>
        <div className="funnel funnel-steps">
          {funnelSteps.map((step) => {
            const rate = step.previous === null ? null : stepRate(step.count, step.previous);
            return (
              <article key={step.key} className="card stat-card">
                <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{step.label}</h3>
                <p className="stat-num">{step.count}</p>
                {step.previous !== null && (
                  <p className="muted" style={{ margin: "0.15rem 0 0" }}>
                    {rate === null ? zh.admin.funnelNoBase : fill(zh.admin.funnelRate, { rate: String(rate) })}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <div className="insight-grid">
        <section className="card" style={{ padding: "1rem" }} aria-labelledby="top-products-title">
          <h2 id="top-products-title" style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>{zh.admin.topProducts}</h2>
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>{zh.admin.topProductsLead}</p>
          {!top.length && <p className="muted" style={{ margin: 0 }}>{zh.admin.empty}</p>}
          {top.length > 0 && (
            <ol className="rank-list">
              {top.map((row) => (
                <li key={row.productId} className="rank-row">
                  <strong>{row.name}</strong>
                  <span className="muted">{fill(zh.admin.soldCount, { count: String(row.quantity) })}</span>
                  <span>{formatRmb(row.revenueCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card" style={{ padding: "1rem" }} aria-labelledby="low-stock-title">
          <h2 id="low-stock-title" style={{ margin: "0 0 0.35rem", fontSize: "1.05rem" }}>{zh.admin.lowStock}</h2>
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>{zh.admin.lowStockLead}</p>
          {!low.length && <p className="muted" style={{ margin: 0 }}>{zh.admin.lowStockNone}</p>}
          {low.length > 0 && (
            <ul className="low-stock-list">
              {low.map((product) => (
                <li key={product.id}>
                  <Link href="/admin/products">{product.name}</Link>
                  <span className="muted">
                    {zh.admin.stock} {product.stock}
                    {zh.common.listSep}
                    {zh.admin.lowStockThreshold} {product.lowStockThreshold}
                    {!product.active ? `${zh.common.listSep}${zh.admin.unlisted}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
