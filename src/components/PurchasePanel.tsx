"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRmb } from "@/lib/money";
import { zh } from "@/i18n/zh";
import { AddToCartButton } from "./AddToCartButton";

export function PurchasePanel({
  productId,
  priceCents,
  isSubscription,
  loggedIn,
}: {
  productId: string;
  priceCents: number;
  isSubscription: boolean;
  loggedIn: boolean;
}) {
  const choices = isSubscription
    ? [
        { qty: 1, label: "1 个月" },
        { qty: 3, label: "3 个月" },
        { qty: 6, label: "6 个月" },
      ]
    : [
        { qty: 1, label: "1 件" },
        { qty: 2, label: "2 件" },
        { qty: 3, label: "3 件" },
      ];
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

      {isSubscription && (
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

      {intent === "buy" ? (
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
      ) : (
        <div className="stack" style={{ gap: "0.75rem" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {zh.shop.renewHint}
          </p>
          <Link href={loggedIn ? "/orders" : "/login?next=/orders"} className="btn btn-primary">
            {zh.shop.renewGo}
          </Link>
        </div>
      )}
      <div className="badge badge-mock">{zh.common.mockPay}</div>
    </aside>
  );
}
