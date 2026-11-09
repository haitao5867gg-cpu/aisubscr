import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";
import { PlanCard } from "@/components/PlanCard";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <p className="eyebrow">{zh.shop.navPlans}</p>
      <h1 className="page-title">{zh.shop.compareTitle}</h1>
      <p className="page-desc">{zh.shop.compareLead}</p>
      <div className="plan-grid">
        {products.map((product) => (
          <PlanCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
