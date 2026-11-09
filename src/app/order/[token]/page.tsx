import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OrderTimeline } from "@/components/OrderTimeline";
import { SupportFab } from "@/components/SupportFab";
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
  const hasRenewable = order.items.some((i) => i.isSubscription);

  return (
    <>
      <Header />
      <main className="container" style={{ paddingTop: "1.75rem", paddingBottom: "3rem", minHeight: "70vh", maxWidth: "48rem" }}>
        <div className="stack">
          <div className="alert alert-info">公开订单页 · 通过不可猜测链接访问，无需登录</div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>
                订单 {order.orderNo}
              </h1>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                创建于 {order.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                {order.isRenewal ? " · 续费单" : ""}
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <OrderTimeline status={order.status} />

          <div className="card stack" style={{ padding: "1.25rem" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">应付 / 实付金额</span>
              <strong style={{ color: "var(--primary)", fontSize: "1.35rem" }}>{formatRmb(order.totalCents)}</strong>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">支付方式</span>
              <span>
                {order.paymentMethod || "—"}
                {order.paymentProvider === "MOCK" && (
                  <>
                    {" "}
                    <span className="badge badge-mock">{zh.common.mockPay}</span>
                  </>
                )}
              </span>
            </div>
            {hasRenewable && (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">续费</span>
                <span className="badge badge-mock">{zh.product.subscription}</span>
              </div>
            )}
            <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "0.25rem 0" }} />
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

          <section className="card stack" style={{ padding: "1.25rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>售后支持</h2>
            <div className="muted">
              {zh.support.email}：{settings?.supportEmail}
              <br />
              {zh.support.hours}：{settings?.supportHours}
            </div>
            {!order.tickets.length && <p className="muted">暂无工单。登录后可在订单页提交售后。</p>}
            {order.tickets.map((t) => (
              <div key={t.id} className="card" style={{ padding: "0.9rem", background: "var(--canvas)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{t.subject}</strong>
                  <StatusBadge status={t.status} kind="ticket" />
                </div>
                {t.replies.map((r) => (
                  <div key={r.id} style={{ marginTop: "0.5rem", fontSize: "0.92rem" }}>
                    <span className="badge badge-example">{r.isStaff ? "客服" : "用户"}</span> {r.body}
                  </div>
                ))}
              </div>
            ))}
            <Link href="/login" className="btn btn-secondary">
              登录后提交售后
            </Link>
          </section>
        </div>
      </main>
      <Footer />
      <SupportFab
        supportEmail={settings?.supportEmail || "support@example.com"}
        supportHours={settings?.supportHours || "08:00–23:00"}
      />
    </>
  );
}
