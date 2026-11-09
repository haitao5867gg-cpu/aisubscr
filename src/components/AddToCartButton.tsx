"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zh } from "@/i18n/zh";

export function AddToCartButton({
  productId,
  quantity = 1,
  label,
}: {
  productId: string;
  quantity?: number;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, quantity }),
        });
        setBusy(false);
        router.push("/cart");
        router.refresh();
      }}
    >
      {busy ? zh.common.loading : label || zh.product.addToCart}
    </button>
  );
}
