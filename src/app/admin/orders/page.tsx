import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminOrderActions } from "@/components/AdminOrderActions";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const zh = getDict(await getLocale());
  const orders = await prisma.order.findMany({
    include: { user: { select: { email: true } }, items: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.orders}</h1>
      {!orders.length && <p className="muted">{zh.admin.empty}</p>}
      {orders.map((o) => (
        <div key={o.id} className="card stack" style={{ padding: "1.1rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>
              {o.orderNo} · {o.user.email}
            </strong>
            <StatusBadge status={o.status} />
          </div>
          <div className="muted">
            {o.items.map((i) => i.productName).join("、")} · {formatRmb(o.totalCents)}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {zh.admin.shareLink}：/order/{o.publicToken}
          </div>
          <AdminOrderActions orderId={o.id} status={o.status} />
        </div>
      ))}
    </div>
  );
}
