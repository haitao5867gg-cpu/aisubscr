import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { AdminProductForm } from "@/components/AdminProductForm";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.products}</h1>
      <AdminProductForm />
      {products.map((p) => (
        <div key={p.id} className="card row" style={{ padding: "1rem", justifyContent: "space-between" }}>
          <div>
            <strong>{p.name}</strong>
            <div className="muted">
              {formatRmb(p.priceCents)} · {p.active ? "上架" : "下架"}
              {p.isSubscription ? " · 可续费" : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
