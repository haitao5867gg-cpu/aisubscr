import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { catalogOrderBy } from "@/lib/catalog";
import { AdminProductForm } from "@/components/AdminProductForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const zh = getDict(await getLocale());
  const products = await prisma.product.findMany({ orderBy: catalogOrderBy });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.products}</h1>
      <AdminProductForm />
      {!products.length && <p className="muted">{zh.admin.empty}</p>}
      {products.map((product) => (
        <details key={product.id} className="card" style={{ padding: "0.4rem 1rem 1rem" }}>
          <summary className="row" style={{ justifyContent: "space-between", minHeight: 44, cursor: "pointer" }}>
            <strong>{product.name}</strong>
            <span className="muted">
              {formatRmb(product.priceCents)} · {product.active ? zh.admin.listed : zh.admin.unlisted}
              {product.stock === null ? "" : ` · ${zh.admin.stock} ${product.stock}`}
              {` · ${zh.admin.sortOrder} ${product.sortOrder}`}
            </span>
          </summary>
          <AdminProductForm product={product} />
        </details>
      ))}
    </div>
  );
}
