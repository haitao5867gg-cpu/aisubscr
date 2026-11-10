import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/session";
import { PurchasePanel } from "@/components/PurchasePanel";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [product, t] = await Promise.all([
    prisma.product.findFirst({ where: { id, active: true } }),
    getLocale().then((locale) => getDict(locale)),
  ]);
  const description = product?.description?.replace(/\s+/g, " ").slice(0, 160) || t.seo.productFallback;
  return pageMeta({
    title: product?.name || t.seo.productsTitle,
    description,
    path: `/products/${id}`,
  });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const zh = getDict(await getLocale());
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
        inStock={product.stock === null || product.stock > 0}
      />
      <div className="detail-main stack">
        <div>
          <p className="eyebrow">{zh.product.detail}</p>
          <h1 className="page-title">{product.name}</h1>
          {product.imageUrl && (
            // Same-origin paths only; the CSP does not allow remote images.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="product-photo" />
          )}
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
