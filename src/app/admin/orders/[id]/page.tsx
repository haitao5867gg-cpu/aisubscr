import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { formatShanghai } from "@/lib/admin-stats";
import { AdminOrderActions } from "@/components/AdminOrderActions";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

function pretty(json: string | null) {
  if (!json) return null;
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getLocale();
  const zh = getDict(locale);
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } }, items: true },
  });
  if (!order) notFound();
  const logs = await prisma.auditLog.findMany({
    where: { targetType: "order", targetId: order.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">{zh.admin.orders}</p>
          <h1 className="page-title" style={{ margin: 0 }}>{order.orderNo}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="card stack" style={{ padding: "1.1rem" }}>
        <div>
          <Link href={`/admin/users/${order.user.id}`}>{order.user.email}</Link>
          {order.user.name ? <span className="muted"> · {order.user.name}</span> : null}
        </div>
        <div>{formatRmb(order.totalCents)}</div>
        <div className="muted">{formatShanghai(order.createdAt, locale)}</div>
        <div className="muted">
          {zh.admin.shareLink}：/order/{order.publicToken}
        </div>
        <ul className="plain-list">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.productName} × {item.quantity} · {formatRmb(item.unitPriceCents)}
            </li>
          ))}
        </ul>
        <AdminOrderActions orderId={order.id} status={order.status} />
      </div>
      {logs.length > 0 && (
        <section className="stack">
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.admin.audit}</h2>
          {logs.map((log) => (
            <article key={log.id} className="card" style={{ padding: "0.9rem 1rem" }}>
              <strong>{log.action}</strong>
              <div className="muted">
                {log.actorEmail} · {formatShanghai(log.createdAt, locale)}
              </div>
              {log.note && <p style={{ margin: "0.4rem 0 0" }}>{log.note}</p>}
              {pretty(log.beforeJson) && <pre className="audit-json">{pretty(log.beforeJson)}</pre>}
              {pretty(log.afterJson) && <pre className="audit-json">{pretty(log.afterJson)}</pre>}
            </article>
          ))}
        </section>
      )}
      <Link href="/admin/orders" className="btn btn-secondary">{zh.common.back}</Link>
    </div>
  );
}
