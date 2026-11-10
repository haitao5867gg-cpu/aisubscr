"use client";

import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function PayPanel({ orderId }: { orderId: string }) {
  const zh = useDict();
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
    if (!res.ok) {
      setBusy(false);
      setError(data.error || zh.payment.payFailed);
      return;
    }
    const redirectUrl = typeof data.payment?.redirectUrl === "string" ? data.payment.redirectUrl : "";
    // Same-origin MOCK completion is a POST so a cross-site navigation cannot pay the order.
    if (redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")) {
      const done = await fetch(redirectUrl, { method: "POST" });
      const payload = await done.json().catch(() => ({}));
      if (!done.ok) {
        setBusy(false);
        setError(payload.error || zh.payment.payFailed);
        return;
      }
      window.location.href = typeof payload.redirect === "string" ? payload.redirect : `/orders/${orderId}?paid=1`;
      return;
    }
    window.location.href = redirectUrl;
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
          {value === "MOCK" ? <span className="badge badge-mock">{zh.common.mockPay}</span> : null}
        </label>
      ))}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy} onClick={pay}>
        {busy ? zh.common.loading : zh.order.pay}
      </button>
    </div>
  );
}
