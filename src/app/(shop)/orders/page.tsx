import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { formatDay, renewalDate } from "@/lib/renewal";
import { StatusBadge } from "@/components/StatusBadge";
import { AccountFrame } from "@/components/AccountFrame";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login?next=/orders");
  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AccountFrame current="orders">
      <div>
        <h1 className="page-title">{zh.order.history}</h1>
        <p className="page-desc">{zh.shop.renewalNote}</p>
      </div>
      {!orders.length && <p className="muted">暂无订单</p>}
      <div className="card">
        {orders.map((order) => {
          const renews = renewalDate(order);
          return (
            <Link key={order.id} href={`/orders/${order.id}`} className="ledger-row">
              <strong>{order.orderNo}</strong>
              <span className="muted">
                {order.items.map((item) => item.productName).join("、")}
                {order.isRenewal ? " · 续费单" : ""}
                {renews ? ` · ${zh.shop.nextRenewal} ${formatDay(renews)}` : ""}
              </span>
              <span>{formatRmb(order.totalCents)}</span>
              <StatusBadge status={order.status} />
            </Link>
          );
        })}
      </div>
    </AccountFrame>
  );
}
