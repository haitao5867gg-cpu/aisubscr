import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDay, renewalDate } from "@/lib/renewal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OrderTimeline } from "@/components/OrderTimeline";
import { OrderSummary } from "@/components/OrderSummary";
import { SupportFab } from "@/components/SupportFab";
import { StatusBadge } from "@/components/StatusBadge";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { OrderCountdown } from "@/components/OrderCountdown";
import { expireDueOrders } from "@/lib/order-expiry";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.orderTitle, description: t.shop.publicNote, path: `/order/${token}`, index: false });
}

export default async function PublicOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const zh = getDict(await getLocale());
  const { token } = await params;
  await expireDueOrders();
  const order = await prisma.order.findFirst({
    where: { publicToken: token },
    include: {
      items: true,
      tickets: {
        orderBy: { createdAt: "desc" },
        select: { id: true, subject: true, status: true },
      },
    },
  });
  if (!order) notFound();
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const renews = renewalDate(order);
  const supportEmail = settings?.supportEmail || "support@example.com";
  const supportHours = settings?.supportHours || "08:00–23:00";

  return (
    <>
      <a className="skip-link" href="#main">
        {zh.common.skipToContent}
      </a>
      <Header />
      <AnnouncementBanner />
      <main id="main" className="container main-pad" style={{ paddingTop: "1.75rem", minHeight: "70vh" }}>
        <div className="stack">
          <div>
            <p className="eyebrow">{zh.shop.publicNote}</p>
            <h1 className="page-title" style={{ marginBottom: "0.25rem" }}>
              {order.orderNo}
            </h1>
            <p className="muted" style={{ marginTop: 0 }}>
              {zh.shop.placedAt} {order.createdAt.toISOString().replace("T", " ").slice(0, 19)}
            </p>
          </div>
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
              {(order.status === "PENDING" || order.status === "PAYING") && order.expiresAt && (
                <OrderCountdown expiresAt={order.expiresAt.toISOString()} />
              )}
              <OrderTimeline status={order.status} />
              <section className="card stack" style={{ padding: "1.2rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{zh.shop.supportCard}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {zh.support.email}{zh.common.colon}
                  <a href={`mailto:${supportEmail}`} className="text-link">
                    {supportEmail}
                  </a>
                  <br />
                  {zh.support.hours}{zh.common.colon}{supportHours}
                </p>
                {!order.tickets.length && <p className="muted">{zh.shop.noPublicTickets}</p>}
                {order.tickets.map((ticket) => (
                  <div key={ticket.id} style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{ticket.subject}</strong>
                      <StatusBadge status={ticket.status} kind="ticket" />
                    </div>
                  </div>
                ))}
                <Link href="/login?next=/orders" className="btn btn-secondary">
                  {zh.shop.loginForTicket}
                </Link>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <SupportFab supportEmail={supportEmail} supportHours={supportHours} />
    </>
  );
}
