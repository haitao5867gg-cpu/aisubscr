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
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function PublicOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await prisma.order.findFirst({
    where: { publicToken: token },
    include: {
      items: true,
      tickets: {
        orderBy: { createdAt: "desc" },
        include: { replies: { orderBy: { createdAt: "asc" } } },
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
      <Header />
      <main className="container" style={{ paddingTop: "1.75rem", paddingBottom: "3rem", minHeight: "70vh" }}>
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
              paymentMethod={order.paymentMethod}
              paymentProvider={order.paymentProvider}
              isRenewal={order.isRenewal}
              renewalDay={renews ? formatDay(renews) : null}
              items={order.items}
            />
            <div className="detail-main stack">
              <OrderTimeline status={order.status} />
              <section className="card stack" style={{ padding: "1.2rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{zh.shop.supportCard}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {zh.support.email}：
                  <a href={`mailto:${supportEmail}`} style={{ color: "var(--primary)" }}>
                    {supportEmail}
                  </a>
                  <br />
                  {zh.support.hours}：{supportHours}
                </p>
                {!order.tickets.length && <p className="muted">暂无工单。登录后可在订单页提交售后。</p>}
                {order.tickets.map((ticket) => (
                  <div key={ticket.id} style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>{ticket.subject}</strong>
                      <StatusBadge status={ticket.status} kind="ticket" />
                    </div>
                    {ticket.replies.map((reply) => (
                      <div key={reply.id} style={{ marginTop: "0.45rem", fontSize: "0.92rem" }}>
                        <span className="badge badge-example">{reply.isStaff ? "客服" : "用户"}</span> {reply.body}
                      </div>
                    ))}
                  </div>
                ))}
                <Link href="/login?next=/orders" className="btn btn-secondary">
                  登录后提交售后
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
