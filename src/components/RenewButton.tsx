"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function RenewButton({ orderId }: { orderId: string }) {
  const zh = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch(`/api/orders/${orderId}/renew`, { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(typeof data.error === "string" && data.error ? data.error : zh.shop.renewFailed);
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
        {busy ? zh.common.loading : zh.order.renew}
      </button>
    </div>
  );
}
