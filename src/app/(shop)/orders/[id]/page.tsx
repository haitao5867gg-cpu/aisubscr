import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { PayPanel } from "@/components/PayPanel";
import { RenewButton } from "@/components/RenewButton";
import { TicketForm } from "@/components/TicketForm";
import { OrderTimeline } from "@/components/OrderTimeline";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login");
  const order = await prisma.order.findFirst({
    where: { id, userId: session.userId },
    include: { items: true, tickets: true },
  });
  if (!order) notFound();
  const canRenew =
    ["PAID", "COMPLETED"].includes(order.status) && order.items.some((i) => i.isSubscription);
  const shareUrl = `/order/${order.publicToken}`;

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          订单 {order.orderNo}
        </h1>
        <StatusBadge status={order.status} />
      </div>
      {sp.paid === "1" && <div className="alert alert-mock">{zh.payment.success}（模拟支付）</div>}

      <OrderTimeline status={order.status} />

      <div className="card stack" style={{ padding: "1.25rem" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">合计</span>
          <strong style={{ color: "var(--primary)", fontSize: "1.25rem" }}>{formatRmb(order.totalCents)}</strong>
        </div>
        {order.paymentMethod && (
          <div className="muted">
            支付方式：{order.paymentMethod}
            {order.paymentProvider === "MOCK" && (
              <>
                {" "}
                <span className="badge badge-mock">{zh.common.mockPay}</span>
              </>
            )}
          </div>
        )}
        {order.items.map((i) => (
          <div key={i.id} className="row" style={{ justifyContent: "space-between" }}>
            <span>
              {i.productName} × {i.quantity}
              {i.isSubscription ? "（可续费）" : ""}
            </span>
            <span>{formatRmb(i.unitPriceCents * i.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "1.1rem" }}>
        <div className="muted" style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>
          {zh.order.shareHint}
        </div>
        <Link href={shareUrl} style={{ color: "var(--primary)", wordBreak: "break-all" }}>
          {shareUrl}
        </Link>
      </div>

      {order.status === "PENDING" && <PayPanel orderId={order.id} />}

      <div className="row">
        {canRenew && <RenewButton orderId={order.id} />}
        <Link href="/orders" className="btn btn-secondary">
          {zh.common.back}
        </Link>
      </div>

      {["PAID", "COMPLETED", "REFUNDED"].includes(order.status) && (
        <>
          <TicketForm orderId={order.id} />
          {order.tickets.length > 0 && (
            <div className="stack">
              <h3 style={{ margin: 0 }}>相关工单</h3>
              {order.tickets.map((t) => (
                <Link key={t.id} href={`/tickets/${t.id}`} className="card" style={{ padding: "0.9rem", display: "block" }}>
                  {t.subject} <StatusBadge status={t.status} kind="ticket" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
