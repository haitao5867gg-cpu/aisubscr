import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatDay, renewalDate } from "@/lib/renewal";
import { StatusBadge } from "@/components/StatusBadge";
import { PayPanel } from "@/components/PayPanel";
import { RenewButton } from "@/components/RenewButton";
import { TicketForm } from "@/components/TicketForm";
import { OrderTimeline } from "@/components/OrderTimeline";
import { OrderSummary } from "@/components/OrderSummary";
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
  const canRenew = ["PAID", "COMPLETED"].includes(order.status) && order.items.some((item) => item.isSubscription);
  const renews = renewalDate(order);
  const shareUrl = `/order/${order.publicToken}`;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">{zh.order.title}</p>
          <h1 className="page-title" style={{ margin: 0 }}>
            {order.orderNo}
          </h1>
        </div>
        <StatusBadge status={order.status} />
      </div>
      {sp.paid === "1" && <div className="alert alert-mock">{zh.payment.success}（模拟支付）</div>}

      <div className="detail-grid">
        <OrderSummary
          orderNo={order.orderNo}
          status={order.status}
          totalCents={order.totalCents}
          paymentMethod={order.paymentMethod}
          paymentProvider={order.paymentProvider}
          isRenewal={order.isRenewal}
          renewalDay={renews ? formatDay(renews) : null}
          items={order.items}
        />
        <div className="detail-main stack">
          <OrderTimeline status={order.status} />
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
                  {order.tickets.map((ticket) => (
                    <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="card" style={{ padding: "0.9rem", display: "block" }}>
                      {ticket.subject} <StatusBadge status={ticket.status} kind="ticket" />
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
