"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function CartLineControls({ productId, quantity }: { productId: string; quantity: number }) {
  const zh = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setQty(next: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: Math.max(0, next) }),
      });
      if (!res.ok) {
        setError(zh.shop.cartUpdateFailed);
        return;
      }
      router.refresh();
    } catch {
      setError(zh.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "0.4rem" }}>
    <div className="row" style={{ gap: "0.65rem" }}>
      <div className="qty">
        <button type="button" aria-label={zh.common.decrease} disabled={busy} onClick={() => setQty(quantity - 1)}>
          −
        </button>
        <span>{quantity}</span>
        <button type="button" aria-label={zh.common.increase} disabled={busy} onClick={() => setQty(quantity + 1)}>
          +
        </button>
      </div>
      <button type="button" className="qty-remove" disabled={busy} onClick={() => setQty(0)}>
        {zh.cart.remove}
      </button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
