import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { PlanCard } from "@/components/PlanCard";
import { EmptyState } from "@/components/EmptyState";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.productsTitle, description: t.seo.productsDescription, path: "/products" });
}

export default async function ProductsPage() {
  const zh = getDict(await getLocale());
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <p className="eyebrow">{zh.shop.navPlans}</p>
      <h1 className="page-title">{zh.shop.compareTitle}</h1>
      <p className="page-desc">{zh.shop.compareLead}</p>
      {products.length ? (
        <div className="plan-grid">
          {products.map((product) => (
            <PlanCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState title={zh.shop.noProducts} />
      )}
    </div>
  );
}
