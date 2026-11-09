import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <h1 className="page-title">{zh.product.listTitle}</h1>
      <p className="page-desc">以下为占位示例商品，仅用于演示商城流程。</p>
      <div className="grid-products">
        {products.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`} className="card" style={{ padding: "1.25rem", display: "block" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{p.name}</strong>
              <span className="badge badge-example">示例</span>
            </div>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {p.description.slice(0, 90)}…
            </p>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong style={{ color: "var(--primary)" }}>{formatRmb(p.priceCents)}</strong>
              {p.isSubscription && <span className="badge badge-mock">{zh.product.subscription}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
