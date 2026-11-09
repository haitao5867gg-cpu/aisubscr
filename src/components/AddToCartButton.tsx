"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zh } from "@/i18n/zh";

export function AddToCartButton({ productId }: { productId: string }) {
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
          body: JSON.stringify({ productId, quantity: 1 }),
        });
        setBusy(false);
        router.push("/cart");
        router.refresh();
      }}
    >
      {zh.product.addToCart}
    </button>
  );
}
