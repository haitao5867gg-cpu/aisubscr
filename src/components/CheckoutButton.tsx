"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function CheckoutButton({ label }: { label?: string }) {
  const zh = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack">
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/orders", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(typeof data.error === "string" && data.error ? data.error : zh.shop.orderFailed);
              return;
            }
            router.push(`/orders/${data.order.id}`);
            router.refresh();
          } catch {
            setError(zh.common.requestFailed);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? zh.common.loading : label || zh.cart.checkout}
      </button>
    </div>
  );
}
