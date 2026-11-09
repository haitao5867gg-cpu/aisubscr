import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminOrderActions } from "@/components/AdminOrderActions";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: { user: { select: { email: true } }, items: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.orders}</h1>
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
            分享链接：/order/{o.publicToken}
          </div>
          <AdminOrderActions orderId={o.id} status={o.status} />
        </div>
      ))}
    </div>
  );
}
