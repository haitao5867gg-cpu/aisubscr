import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { zh } from "@/i18n/zh";
import { AddToCartButton } from "@/components/AddToCartButton";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, active: true } });
  if (!product) notFound();

  return (
    <div className="card" style={{ padding: "1.75rem", maxWidth: 720 }}>
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <span className="badge badge-example">{zh.common.exampleData}</span>
        {product.isSubscription && <span className="badge badge-mock">{zh.product.subscription}</span>}
      </div>
      <h1 className="page-title">{product.name}</h1>
      <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
      <div className="row" style={{ marginTop: "1.25rem", justifyContent: "space-between" }}>
        <strong style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{formatRmb(product.priceCents)}</strong>
        <AddToCartButton productId={product.id} />
      </div>
    </div>
  );
}
