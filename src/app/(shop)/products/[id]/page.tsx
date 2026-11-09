import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";
import { getSession } from "@/lib/session";
import { PurchasePanel } from "@/components/PurchasePanel";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, session] = await Promise.all([
    prisma.product.findFirst({ where: { id, active: true } }),
    getSession(),
  ]);
  if (!product) notFound();

  return (
    <div className="detail-grid">
      <PurchasePanel
        productId={product.id}
        priceCents={product.priceCents}
        isSubscription={product.isSubscription}
        loggedIn={Boolean(session.isLoggedIn)}
      />
      <div className="detail-main stack">
        <div>
          <p className="eyebrow">{zh.product.detail}</p>
          <h1 className="page-title">{product.name}</h1>
          <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{product.description}</p>
        </div>
        <section className="card" style={{ padding: "1.15rem 1.25rem" }}>
          <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.05rem" }}>{zh.shop.includes}</h2>
          <ul className="plain-list">
            <li>{product.isSubscription ? zh.shop.periodHint : zh.shop.qtyHint}</li>
            <li>{product.isSubscription ? zh.shop.renewHint : zh.shop.renewSkip}</li>
            <li>{zh.payment.mockNote}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
