import type { Metadata } from "next";
import Link from "next/link";
import { formatRmb } from "@/lib/money";
import { getActiveProducts, getPublicSettings } from "@/lib/public-content";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { PlanCard } from "@/components/PlanCard";
import { EmptyState } from "@/components/EmptyState";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, pageMeta } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.homeTitle, description: t.seo.homeDescription, path: "/" });
}

export default async function HomePage() {
  const zh = getDict(await getLocale());
  const [catalog, settings] = await Promise.all([getActiveProducts(), getPublicSettings()]);
  const products = catalog.slice(0, 6);
  const supportEmail = settings?.supportEmail || "support@example.com";
  const supportHours = settings?.supportHours || "08:00–23:00";

  const steps = [
    [zh.shop.how1t, zh.shop.how1d],
    [zh.shop.how2t, zh.shop.how2d],
    [zh.shop.how3t, zh.shop.how3d],
    [zh.shop.how4t, zh.shop.how4d],
  ];
  const faqs = [
    [zh.shop.faq1q, zh.shop.faq1a],
    [zh.shop.faq2q, zh.shop.faq2a],
    [zh.shop.faq3q, zh.shop.faq3a],
    [zh.shop.faq4q, zh.shop.faq4a],
  ];

  const origin = siteUrl();
  return (
    <div>
      <JsonLd
        data={organizationJsonLd({
          name: settings?.siteName || zh.siteName,
          url: origin,
          email: supportEmail,
          logo: `${origin}/og.png`,
        })}
      />
      <section className="shop-hero">
        <div>
          <p className="eyebrow">{zh.shop.eyebrow}</p>
          <h1>{zh.home.headline}</h1>
          <p className="text-secondary" style={{ maxWidth: "38rem", marginTop: 0 }}>
            {zh.home.description}
          </p>
          <div className="row" style={{ marginBottom: "0.85rem" }}>
            <Link href="/products" className="btn btn-primary">
              {zh.home.ctaProducts}
            </Link>
            <Link href="/account" className="btn btn-secondary">
              {zh.nav.account}
            </Link>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {zh.shop.guideLink}{" "}
            <Link href="/blog" className="text-link">
              {zh.home.ctaBlog}
            </Link>
          </p>
        </div>
        <aside className="card receipt">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{zh.shop.receiptTitle}</strong>
            <span className="badge badge-mock">{zh.common.mockPay}</span>
          </div>
          {products.slice(0, 4).map((product) => (
            <div key={product.id} className="receipt-line">
              <span>{product.name}</span>
              <span>{formatRmb(product.priceCents)}</span>
            </div>
          ))}
          {!products.length && <p className="muted">{zh.shop.noProducts}</p>}
          <Link href="/products" className="btn btn-primary" style={{ marginTop: "0.6rem" }}>
            {zh.home.ctaProducts}
          </Link>
        </aside>
      </section>

      <section className="shop-section">
        <h2 className="section-kicker">{zh.shop.featuredTitle}</h2>
        <p className="section-lead muted">{zh.shop.featuredLead}</p>
        {products.length ? (
          <div className="plan-grid">
            {products.map((product) => (
              <PlanCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState title={zh.shop.noProducts} />
        )}
      </section>

      <section className="shop-section">
        <h2 className="section-kicker">{zh.shop.howTitle}</h2>
        <ol className="how-list">
          {steps.map(([title, body], index) => (
            <li key={title}>
              <span className="how-num">{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="shop-section">
        <div className="card trust-band">
          <div>
            <h2 className="section-kicker">{zh.shop.trustTitle}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {zh.shop.trustLead}
            </p>
            <p style={{ marginBottom: "0.2rem" }}>
              <span className="muted">{zh.support.email}{zh.common.colon}</span>
              <a href={`mailto:${supportEmail}`} className="text-link">
                {supportEmail}
              </a>
            </p>
            <p className="muted" style={{ marginTop: 0 }}>
              {zh.support.hours}{zh.common.colon}{supportHours}
            </p>
            <Link href="/tickets" className="btn btn-secondary">
              {zh.nav.tickets}
            </Link>
          </div>
          <div className="trust-points">
            <div>
              <strong>{zh.shop.trustPayT}</strong>
              <p className="muted">{zh.shop.trustPayD}</p>
            </div>
            <div>
              <strong>{zh.shop.trustShareT}</strong>
              <p className="muted">{zh.shop.trustShareD}</p>
            </div>
            <div>
              <strong>{zh.shop.trustCareT}</strong>
              <p className="muted">{zh.shop.trustCareD}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="shop-section">
        <h2 className="section-kicker">{zh.shop.faqTitle}</h2>
        <p style={{ marginTop: 0 }}>
          <Link href="/help" className="text-link">
            {zh.shop.moreHelp}
          </Link>
        </p>
        <div>
          {faqs.map(([question, answer]) => (
            <details key={question} className="faq-item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
