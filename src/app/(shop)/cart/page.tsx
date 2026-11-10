import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { CheckoutButton } from "@/components/CheckoutButton";
import { CartLineControls } from "@/components/CartLineControls";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.cartTitle, description: t.seo.cartDescription, path: "/cart" });
}

export default async function CartPage() {
  const zh = getDict(await getLocale());
  const session = await getSession();
  const cart = session.cart || [];
  const products = cart.length
    ? await prisma.product.findMany({
        where: { id: { in: cart.map((item) => item.productId) }, active: true },
      })
    : [];
  const map = new Map(products.map((product) => [product.id, product]));
  const items = cart
    .map((item) => {
      const product = map.get(item.productId);
      if (!product) return null;
      return { product, quantity: item.quantity, line: product.priceCents * item.quantity };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const total = items.reduce((sum, item) => sum + item.line, 0);
  const loggedIn = Boolean(session.isLoggedIn && session.userId);

  const steps = [
    { label: zh.shop.stepCart, state: items.length ? "done" : "current" },
    { label: zh.shop.stepAccount, state: !items.length ? "" : loggedIn ? "done" : "current" },
    { label: zh.shop.stepPlace, state: items.length && loggedIn ? "current" : "" },
  ];

  return (
    <div>
      <p className="eyebrow">{zh.nav.cart}</p>
      <h1 className="page-title">{zh.shop.checkoutTitle}</h1>
      <ol className="checkout-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={step.state}>
            {index + 1}. {step.label}
          </li>
        ))}
      </ol>

      {!items.length ? (
        <div className="card stack" style={{ padding: "1.5rem" }}>
          <p style={{ margin: 0 }}>{zh.cart.empty}</p>
          <Link href="/products" className="btn btn-primary">
            {zh.shop.emptyCta}
          </Link>
        </div>
      ) : (
        <div className="checkout-grid">
          <div className="stack">
            {items.map((item) => (
              <div key={item.product.id} className="card line-item">
                <div>
                  <strong>{item.product.name}</strong>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    {formatRmb(item.product.priceCents)}
                    {item.product.isSubscription ? ` ${zh.shop.perMonth}` : ""} · {formatRmb(item.line)}
                  </div>
                  <CartLineControls productId={item.product.id} quantity={item.quantity} />
                </div>
                <strong>{formatRmb(item.line)}</strong>
              </div>
            ))}
            <div className="card" style={{ padding: "1rem 1.1rem" }}>
              <strong>{zh.shop.stepAccount}</strong>
              {loggedIn ? (
                <p className="muted" style={{ marginBottom: 0 }}>
                  {zh.shop.accountReady}：{session.email}
                </p>
              ) : (
                <>
                  <p className="muted">{zh.shop.loginNeeded}</p>
                  <div className="row">
                    <Link href="/login?next=/cart" className="btn btn-primary">
                      {zh.shop.loginToPlace}
                    </Link>
                    <Link href="/register?next=/cart" className="btn btn-secondary">
                      {zh.nav.register}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
          <aside className="card summary-card stack">
            <strong>{zh.shop.summary}</strong>
            {items.map((item) => (
              <div key={item.product.id} className="money-row">
                <span className="muted">
                  {item.product.name} × {item.quantity}
                </span>
                <span>{formatRmb(item.line)}</span>
              </div>
            ))}
            <div className="money-row" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
              <span>{zh.shop.payable}</span>
              <strong className="plan-price" style={{ fontSize: "1.45rem" }}>
                {formatRmb(total)}
              </strong>
            </div>
            <div className="alert alert-mock">{zh.payment.mockNote}</div>
            {loggedIn ? (
              <CheckoutButton label={zh.shop.placeOrder} />
            ) : (
              <Link href="/login?next=/cart" className="btn btn-primary">
                {zh.shop.loginToPlace}
              </Link>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
