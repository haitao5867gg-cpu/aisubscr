"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRmb } from "@/lib/money";
import { useDict } from "@/components/LocaleProvider";
import { AddToCartButton } from "./AddToCartButton";

export function PurchasePanel({
  productId,
  priceCents,
  isSubscription,
  loggedIn,
  inStock = true,
}: {
  productId: string;
  priceCents: number;
  isSubscription: boolean;
  loggedIn: boolean;
  inStock?: boolean;
}) {
  const zh = useDict();
  const unit = isSubscription ? zh.shop.periodCount : zh.shop.qtyCount;
  const choices = (isSubscription ? [1, 3, 6] : [1, 2, 3]).map((qty) => ({
    qty,
    label: unit.replace("{n}", String(qty)),
  }));
  const [qty, setQty] = useState(choices[0].qty);
  const [intent, setIntent] = useState<"buy" | "renew">("buy");
  const total = priceCents * qty;

  return (
    <aside className="card purchase-panel stack">
      <div>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {zh.product.price}
        </div>
        <div className="plan-price">{formatRmb(total)}</div>
        <div className="muted" style={{ fontSize: "0.85rem" }}>
          {formatRmb(priceCents)} {isSubscription ? zh.shop.perMonth : ""}
        </div>
      </div>

      {inStock && isSubscription && (
        <div className="stack" style={{ gap: "0.4rem" }}>
          <span className="label" style={{ margin: 0 }}>
            {zh.shop.renewOption}
          </span>
          <div className="segment" role="group" aria-label={zh.shop.renewOption}>
            <button type="button" aria-pressed={intent === "buy"} onClick={() => setIntent("buy")}>
              {zh.shop.buyNew}
            </button>
            <button type="button" aria-pressed={intent === "renew"} onClick={() => setIntent("renew")}>
              {zh.shop.renewExisting}
            </button>
          </div>
        </div>
      )}

      {!inStock && <div className="alert alert-warn" role="status">{zh.shop.outOfStock}</div>}

      {inStock && intent === "buy" ? (
        <>
          <div className="stack" style={{ gap: "0.4rem" }}>
            <span className="label" style={{ margin: 0 }}>
              {isSubscription ? zh.shop.period : zh.cart.quantity}
            </span>
            <div className="segment" role="group" aria-label={isSubscription ? zh.shop.period : zh.cart.quantity}>
              {choices.map((choice) => (
                <button key={choice.qty} type="button" aria-pressed={qty === choice.qty} onClick={() => setQty(choice.qty)}>
                  {choice.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {isSubscription ? zh.shop.periodHint : zh.shop.qtyHint}
            </p>
          </div>
          <AddToCartButton productId={productId} quantity={qty} label={zh.shop.addCheckout} />
        </>
      ) : inStock ? (
        <div className="stack" style={{ gap: "0.75rem" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {zh.shop.renewHint}
          </p>
          <Link href={loggedIn ? "/orders" : "/login?next=/orders"} className="btn btn-primary">
            {zh.shop.renewGo}
          </Link>
        </div>
      ) : null}
      <div className="badge badge-mock">{zh.common.mockPay}</div>
    </aside>
  );
}
