"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zh } from "@/i18n/zh";

export function RenewButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/orders/${orderId}/renew`, { method: "POST" });
        const data = await res.json();
        setBusy(false);
        if (res.ok) {
          router.push(`/orders/${data.order.id}`);
          router.refresh();
        } else {
          alert(data.error || "续费失败");
        }
      }}
    >
      {zh.order.renew}
    </button>
  );
}
