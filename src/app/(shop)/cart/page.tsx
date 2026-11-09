import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { zh } from "@/i18n/zh";
import { CheckoutButton } from "@/components/CheckoutButton";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await getSession();
  const cart = session.cart || [];
  if (!cart.length) {
    return (
      <div>
        <h1 className="page-title">{zh.cart.title}</h1>
        <p className="page-desc">{zh.cart.empty}</p>
        <Link href="/products" className="btn btn-primary">
          {zh.nav.products}
        </Link>
      </div>
    );
  }
  const products = await prisma.product.findMany({
    where: { id: { in: cart.map((c) => c.productId) }, active: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const items = cart
    .map((c) => {
      const p = map.get(c.productId);
      if (!p) return null;
      return { product: p, quantity: c.quantity, line: p.priceCents * c.quantity };
    })
    .filter(Boolean) as { product: (typeof products)[0]; quantity: number; line: number }[];
  const total = items.reduce((s, i) => s + i.line, 0);

  return (
    <div className="stack">
      <h1 className="page-title">{zh.cart.title}</h1>
      {!session.isLoggedIn && (
        <div className="alert alert-info">
          结算前请先 <Link href="/login">登录</Link> 或 <Link href="/register">注册</Link>。
        </div>
      )}
      {items.map((i) => (
        <div key={i.product.id} className="card row" style={{ padding: "1rem", justifyContent: "space-between" }}>
          <div>
            <strong>{i.product.name}</strong>
            <div className="muted">
              {formatRmb(i.product.priceCents)} × {i.quantity}
            </div>
          </div>
          <strong>{formatRmb(i.line)}</strong>
        </div>
      ))}
      <div className="card row" style={{ padding: "1.25rem", justifyContent: "space-between" }}>
        <strong>合计 {formatRmb(total)}</strong>
        {session.isLoggedIn ? <CheckoutButton /> : <Link href="/login" className="btn btn-primary">去登录</Link>}
      </div>
    </div>
  );
}
