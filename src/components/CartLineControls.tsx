"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zh } from "@/i18n/zh";

export function CartLineControls({ productId, quantity }: { productId: string; quantity: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setQty(next: number) {
    setBusy(true);
    await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: Math.max(0, next) }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="row" style={{ gap: "0.65rem" }}>
      <div className="qty">
        <button type="button" aria-label="减少" disabled={busy} onClick={() => setQty(quantity - 1)}>
          −
        </button>
        <span>{quantity}</span>
        <button type="button" aria-label="增加" disabled={busy} onClick={() => setQty(quantity + 1)}>
          +
        </button>
      </div>
      <button type="button" className="qty-remove" disabled={busy} onClick={() => setQty(0)}>
        {zh.cart.remove}
      </button>
    </div>
  );
}
