"use client";

import { useState } from "react";
import { zh } from "@/i18n/zh";

export function PayPanel({ orderId }: { orderId: string }) {
  const [method, setMethod] = useState<"WECHAT" | "ALIPAY" | "MOCK">("WECHAT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "支付发起失败");
      return;
    }
    // MOCK provider returns a local redirect URL
    window.location.href = data.payment.redirectUrl;
  }

  return (
    <div className="card stack" style={{ padding: "1.25rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{zh.payment.title}</h2>
      <div className="alert alert-mock">{zh.payment.mockNote}</div>
      {(
        [
          ["WECHAT", zh.payment.wechat],
          ["ALIPAY", zh.payment.alipay],
          ["MOCK", zh.payment.mock],
        ] as const
      ).map(([value, label]) => (
        <label key={value} className="pay-option">
          <span className="row" style={{ margin: 0 }}>
            <input type="radio" checked={method === value} onChange={() => setMethod(value)} />
            {label}
          </span>
          <span className="badge badge-mock">{zh.common.mockPay}</span>
        </label>
      ))}
      {error && <div className="alert" style={{ color: "var(--danger)" }}>{error}</div>}
      <button className="btn btn-primary" disabled={busy} onClick={pay}>
        {busy ? zh.common.loading : zh.order.pay}
      </button>
    </div>
  );
}
