"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function AdminOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const zh = useDict();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function setStatus(next: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
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
    <div className="stack" style={{ gap: "0.45rem" }}>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row">
        {status !== "COMPLETED" && status !== "REFUNDED" && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setStatus("COMPLETED")}>
            {zh.admin.markCompleted}
          </button>
        )}
        {status !== "REFUNDED" && status !== "PENDING" && status !== "PAYING" && status !== "CANCELLED" && status !== "FAILED" && (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setStatus("REFUNDED")}>
            {zh.admin.markRefund}
          </button>
        )}
      </div>
    </div>
  );
}
