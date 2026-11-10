import type { Metadata } from "next";
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
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { OrderCountdown } from "@/components/OrderCountdown";
import { expireDueOrders } from "@/lib/order-expiry";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.orderTitle, description: t.seo.orderDescription, path: `/orders/${id}`, index: false });
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const zh = getDict(await getLocale());
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);
  await expireDueOrders();
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
          {sp.paid === "1" && <div className="alert alert-mock" role="status">{zh.payment.success}</div>}
      {(order.status === "PENDING" || order.status === "PAYING") && order.expiresAt && (
        <OrderCountdown expiresAt={order.expiresAt.toISOString()} />
      )}

      <div className="detail-grid">
        <OrderSummary
          orderNo={order.orderNo}
          status={order.status}
          totalCents={order.totalCents}
          subtotalCents={order.subtotalCents}
          discountCents={order.discountCents}
          couponCode={order.couponCode}
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
            <Link href={shareUrl} className="text-link" style={{ wordBreak: "break-all" }}>
              {shareUrl}
            </Link>
          </div>
          {(order.status === "PENDING" || order.status === "PAYING") && <PayPanel orderId={order.id} />}
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
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.shop.relatedTickets}</h2>
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
