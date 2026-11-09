import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login");
  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="stack">
      <h1 className="page-title">{zh.order.history}</h1>
      {!orders.length && <p className="muted">暂无订单</p>}
      {orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="card" style={{ padding: "1.1rem", display: "block" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{o.orderNo}</strong>
            <StatusBadge status={o.status} />
          </div>
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            {o.items.map((i) => i.productName).join("、")} · {formatRmb(o.totalCents)}
            {o.isRenewal ? " · 续费单" : ""}
          </div>
        </Link>
      ))}
    </div>
  );
}
