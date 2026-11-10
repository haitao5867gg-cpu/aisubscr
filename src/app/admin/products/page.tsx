import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { AdminProductForm } from "@/components/AdminProductForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const zh = getDict(await getLocale());
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.products}</h1>
      <AdminProductForm />
      {!products.length && <p className="muted">{zh.admin.empty}</p>}
      {products.map((p) => (
        <div key={p.id} className="card row" style={{ padding: "1rem", justifyContent: "space-between" }}>
          <div>
            <strong>{p.name}</strong>
            <div className="muted">
              {formatRmb(p.priceCents)} · {p.active ? zh.admin.listed : zh.admin.unlisted}
              {p.isSubscription ? ` · ${zh.admin.subscription}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
