"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { canAdminSet } from "@/lib/payments/states";

const ACTIONS = ["PAID", "REFUNDED", "CANCELLED", "COMPLETED"] as const;

export function AdminOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const zh = useDict();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const labels: Record<(typeof ACTIONS)[number], string> = {
    PAID: zh.admin.markPaid,
    REFUNDED: zh.admin.markRefund,
    CANCELLED: zh.admin.markCancel,
    COMPLETED: zh.admin.markCompleted,
  };

  async function setStatus(next: string) {
    if (!note.trim()) {
      setError(zh.admin.noteRequired);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError(zh.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  const available = ACTIONS.filter((next) => next !== status && canAdminSet(status, next));
  if (!available.length) return null;

  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      <div>
        <label className="label" htmlFor={`note-${orderId}`}>{zh.admin.note}</label>
        <textarea
          id={`note-${orderId}`}
          className="textarea"
          required
          value={note}
          placeholder={zh.admin.notePlaceholder}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row">
        {available.map((next) => (
          <button
            key={next}
            type="button"
            className={next === "REFUNDED" || next === "CANCELLED" ? "btn btn-danger" : "btn btn-secondary"}
            disabled={busy}
            onClick={() => setStatus(next)}
          >
            {labels[next]}
          </button>
        ))}
      </div>
    </div>
  );
}
