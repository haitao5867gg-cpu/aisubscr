"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zh } from "@/i18n/zh";

export function CheckoutButton({ label }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack">
      {error && <div className="alert" style={{ color: "var(--danger)" }}>{error}</div>}
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch("/api/orders", { method: "POST" });
          const data = await res.json();
          setBusy(false);
          if (!res.ok) {
            setError(data.error || "下单失败");
            return;
          }
          router.push(`/orders/${data.order.id}`);
          router.refresh();
        }}
      >
        {busy ? zh.common.loading : label || zh.cart.checkout}
      </button>
    </div>
  );
}
