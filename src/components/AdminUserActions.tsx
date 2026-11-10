"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function AdminUserActions({ userId, disabled }: { userId: string; disabled: boolean }) {
  const zh = useDict();
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function setDisabled(next: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
        return;
      }
      setMessage(next ? zh.admin.disabled : zh.admin.enabled);
      router.refresh();
    } catch {
      setError(zh.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
        return;
      }
      setMessage(zh.admin.resetSent);
    } catch {
      setError(zh.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>{zh.admin.disableLead}</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-info" role="status">{message}</div>}
      <div className="row">
        {disabled ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setDisabled(false)}>
            {zh.admin.enable}
          </button>
        ) : (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setDisabled(true)}>
            {zh.admin.disable}
          </button>
        )}
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={sendReset}>
          {zh.admin.sendReset}
        </button>
      </div>
    </div>
  );
}
