"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

type Settings = {
  siteName: string;
  supportEmail: string;
  supportHours: string;
  footerText: string;
};

export function AdminSettingsForm({ initial }: { initial: Settings }) {
  const zh = useDict();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = [
    ["siteName", zh.admin.siteName],
    ["supportEmail", zh.admin.supportEmail],
    ["supportHours", zh.admin.supportHours],
    ["footerText", zh.admin.footerText],
  ] as const;

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem", maxWidth: 560 }}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        setError("");
        if (!form.siteName.trim() || !form.supportEmail.trim()) {
          setError(zh.common.fieldRequired);
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())) {
          setError(zh.auth.emailInvalid);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/admin/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              siteName: form.siteName.trim(),
              supportEmail: form.supportEmail.trim(),
              supportHours: form.supportHours.trim(),
              footerText: form.footerText.trim(),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
            return;
          }
          setSaved(true);
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map(([key, label]) => (
        <div key={key}>
          <label className="label" htmlFor={`setting-${key}`}>{label}</label>
          <input
            id={`setting-${key}`}
            className="input"
            required={key === "siteName" || key === "supportEmail"}
            type={key === "supportEmail" ? "email" : "text"}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? zh.common.loading : zh.admin.saveSettings}
      </button>
      {saved && <div className="alert alert-mock" role="status">{zh.common.saved}</div>}
    </form>
  );
}
