import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/session";
import { JsonLd } from "@/components/JsonLd";
import { PurchasePanel } from "@/components/PurchasePanel";
import { pageMeta, productJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

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
  const [product, session, settings] = await Promise.all([
    prisma.product.findFirst({ where: { id, active: true } }),
    getSession(),
    prisma.siteSetting.findUnique({ where: { id: "default" }, select: { siteName: true } }),
  ]);
  if (!product) notFound();
  const productUrl = `${siteUrl()}/products/${product.id}`;

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: product.name,
          description: product.description,
          sku: product.id,
          priceCents: product.priceCents,
          url: productUrl,
          image: product.imageUrl,
          inStock: product.stock === null || product.stock > 0,
          brand: settings?.siteName || zh.siteName,
        })}
      />
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
            // Same-site uploads, or the configured R2 public host. CSP img-src lists that origin.
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
    </>
  );
}
