import Link from "next/link";
import { formatRmb } from "@/lib/money";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function PlanCard({
  product,
}: {
  product: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    isSubscription: boolean;
    stock?: number | null;
  };
}) {
  const zh = getDict(await getLocale());
  return (
    <article className={`card plan-card ${product.isSubscription ? "renewable" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{product.name}</h2>
        <span className={`badge ${product.stock === 0 ? "badge-example" : product.isSubscription ? "badge-mock" : "badge-example"}`}>
          {product.stock === 0 ? zh.shop.outOfStock : product.isSubscription ? zh.product.subscription : zh.shop.oneTime}
        </span>
      </div>
      <div>
        <div className="plan-price">{formatRmb(product.priceCents)}</div>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {product.isSubscription ? zh.shop.perMonth : zh.shop.oneTime}
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
        {product.description}
      </p>
      <dl className="plan-facts">
        <div>
          <dt>{zh.shop.billing}</dt>
          <dd>{product.isSubscription ? zh.shop.monthly : zh.shop.oneTime}</dd>
        </div>
        <div>
          <dt>{zh.shop.renewal}</dt>
          <dd>{product.isSubscription ? zh.shop.renewIncluded : zh.shop.renewSkip}</dd>
        </div>
      </dl>
      <Link href={`/products/${product.id}`} className={product.isSubscription ? "btn btn-primary" : "btn btn-secondary"}>
        {zh.shop.choosePlan}
      </Link>
    </article>
  );
}
