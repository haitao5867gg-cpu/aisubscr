"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function AddToCartButton({
  productId,
  quantity = 1,
  label,
}: {
  productId: string;
  quantity?: number;
  label?: string;
}) {
  const zh = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId, quantity }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(typeof data.error === "string" && data.error ? data.error : zh.shop.cartUpdateFailed);
              return;
            }
            router.push("/cart");
            router.refresh();
          } catch {
            setError(zh.common.requestFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? zh.common.loading : label || zh.product.addToCart}
      </button>
    </div>
  );
}
