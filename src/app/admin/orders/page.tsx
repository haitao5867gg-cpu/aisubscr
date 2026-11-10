import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { adminOrderWhere, orderFilterQuery, readOrderFilters } from "@/lib/admin-orders";
import { formatShanghai } from "@/lib/admin-stats";
import { ORDER_STATUSES } from "@/lib/payments/states";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const zh = getDict(locale);
  const filters = readOrderFilters(await searchParams);
  const orders = await prisma.order.findMany({
    where: adminOrderWhere(filters),
    include: { user: { select: { email: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const query = orderFilterQuery(filters);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title" style={{ margin: 0 }}>{zh.admin.orders}</h1>
        <a className="btn btn-secondary" href={`/api/admin/orders/export${query}`}>{zh.admin.exportCsv}</a>
      </div>
      <form className="card filter-bar" method="get">
        <div>
          <label className="label" htmlFor="order-q">{zh.admin.searchPlaceholder}</label>
          <input id="order-q" className="input" name="q" defaultValue={filters.q ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="order-email">{zh.admin.filterEmail}</label>
          <input id="order-email" className="input" name="email" type="email" defaultValue={filters.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="order-status">{zh.admin.filterStatus}</label>
          <select id="order-status" className="select" name="status" defaultValue={filters.status ?? ""}>
            <option value="">{zh.admin.allStatuses}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {zh.order.status[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="order-from">{zh.admin.filterFrom}</label>
          <input id="order-from" className="input" name="from" type="date" defaultValue={filters.from ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="order-to">{zh.admin.filterTo}</label>
          <input id="order-to" className="input" name="to" type="date" defaultValue={filters.to ?? ""} />
        </div>
        <button className="btn btn-primary" type="submit">{zh.admin.apply}</button>
      </form>
      {!orders.length && <p className="muted">{zh.admin.empty}</p>}
      {orders.length > 0 && (
        <div className="card">
          {orders.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className="ledger-row">
              <strong>{order.orderNo}</strong>
              <span className="muted">
                {order.user.email} · {order.items.map((item) => item.productName).join(zh.common.listSep)} · {formatShanghai(order.createdAt, locale)}
              </span>
              <span>{formatRmb(order.totalCents)}</span>
              <StatusBadge status={order.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
