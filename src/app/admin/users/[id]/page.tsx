import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { formatShanghai } from "@/lib/admin-stats";
import { AdminUserActions } from "@/components/AdminUserActions";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getLocale();
  const zh = getDict(locale);
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!user) notFound();

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">{zh.admin.users}</p>
        <h1 className="page-title">{user.email}</h1>
        <p className="page-desc">
          {user.name || "—"} · {zh.admin.role} {user.role} · {user.disabled ? zh.admin.disabled : zh.admin.enabled}
          {" · "}
          {formatShanghai(user.createdAt, locale)}
        </p>
      </div>
      <div className="card" style={{ padding: "1.1rem" }}>
        <AdminUserActions userId={user.id} disabled={user.disabled} />
      </div>
      <section className="stack">
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.admin.ordersOfUser}</h2>
        {!user.orders.length && <p className="muted">{zh.admin.empty}</p>}
        {user.orders.length > 0 && (
          <div className="card">
            {user.orders.map((order) => (
              <Link key={order.id} href={`/admin/orders/${order.id}`} className="ledger-row">
                <strong>{order.orderNo}</strong>
                <span className="muted">{order.items.map((item) => item.productName).join(zh.common.listSep)}</span>
                <span>{formatRmb(order.totalCents)}</span>
                <StatusBadge status={order.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
      <Link href="/admin/users" className="btn btn-secondary">{zh.common.back}</Link>
    </div>
  );
}
