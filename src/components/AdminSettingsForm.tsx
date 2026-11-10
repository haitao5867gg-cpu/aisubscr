"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

type Settings = {
  siteName: string;
  supportEmail: string;
  supportHours: string;
  footerText: string;
  wechatId: string;
  qq: string;
  contactEmail: string;
  announcementText: string;
  announcementEnabled: boolean;
  orderExpireMinutes: number;
  hasContactQr: boolean;
};

export function AdminSettingsForm({ initial }: { initial: Settings }) {
  const t = useDict();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [qrMime, setQrMime] = useState<string | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [clearQr, setClearQr] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function setField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem", maxWidth: 640 }}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setSaved(false);
        setError("");
        if (!form.siteName.trim() || !form.supportEmail.trim() || !form.supportHours.trim() || !form.footerText.trim()) {
          setError(t.common.fieldRequired);
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())) {
          setError(t.auth.emailInvalid);
          return;
        }
        if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
          setError(t.auth.emailInvalid);
          return;
        }
        const minutes = Number(form.orderExpireMinutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
          setError(t.admin.invalidSettings);
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
              wechatId: form.wechatId.trim(),
              qq: form.qq.trim(),
              contactEmail: form.contactEmail.trim(),
              announcementText: form.announcementText.trim(),
              announcementEnabled: form.announcementEnabled,
              orderExpireMinutes: minutes,
              ...(clearQr ? { clearQr: true } : {}),
              ...(qrMime && qrBase64 && !clearQr ? { qrImageMime: qrMime, qrImageBase64: qrBase64 } : {}),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : t.admin.actionFailed);
            return;
          }
          setSaved(true);
          setQrMime(null);
          setQrBase64(null);
          setClearQr(false);
          router.refresh();
        } catch {
          setError(t.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      {(
        [
          ["siteName", t.admin.siteName],
          ["supportEmail", t.admin.supportEmail],
          ["supportHours", t.admin.supportHours],
          ["footerText", t.admin.footerText],
          ["wechatId", t.admin.wechatId],
          ["qq", t.admin.qq],
          ["contactEmail", t.admin.contactEmail],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label className="label" htmlFor={`setting-${key}`}>{label}</label>
          <input
            id={`setting-${key}`}
            className="input"
            required={key === "siteName" || key === "supportEmail" || key === "supportHours" || key === "footerText"}
            type={key === "supportEmail" || key === "contactEmail" ? "email" : "text"}
            value={form[key]}
            onChange={(event) => setField(key, event.target.value)}
          />
          {key === "contactEmail" && <p className="muted" style={{ margin: "0.35rem 0 0" }}>{t.admin.contactEmailHint}</p>}
        </div>
      ))}
      <div>
        <label className="label" htmlFor="setting-minutes">{t.admin.orderExpireMinutes}</label>
        <input
          id="setting-minutes"
          className="input"
          inputMode="numeric"
          value={String(form.orderExpireMinutes)}
          onChange={(event) => setField("orderExpireMinutes", Number(event.target.value))}
        />
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>{t.admin.orderExpireHint}</p>
      </div>
      <div>
        <label className="label" htmlFor="setting-announcement">{t.admin.announcement}</label>
        <textarea
          id="setting-announcement"
          className="textarea"
          value={form.announcementText}
          onChange={(event) => setField("announcementText", event.target.value)}
        />
        <label className="row" style={{ marginTop: "0.5rem" }}>
          <input
            type="checkbox"
            checked={form.announcementEnabled}
            onChange={(event) => setField("announcementEnabled", event.target.checked)}
          />
          {t.admin.announcementEnabled}
        </label>
      </div>
      <div>
        <label className="label" htmlFor="setting-qr">{t.admin.qrImage}</label>
        <input
          id="setting-qr"
          className="input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setClearQr(false);
            if (!file) {
              setQrMime(null);
              setQrBase64(null);
              return;
            }
            if (file.size > 512 * 1024) {
              setError(t.admin.invalidQr);
              setQrMime(null);
              setQrBase64(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === "string" ? reader.result : "";
              const comma = result.indexOf(",");
              setQrMime(file.type);
              setQrBase64(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.readAsDataURL(file);
          }}
        />
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>{t.admin.qrHint}</p>
        {(form.hasContactQr || qrBase64) && !clearQr && (
          // Preview is a data URL or the same-origin QR route, neither of which should go through the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrBase64 && qrMime ? `data:${qrMime};base64,${qrBase64}` : "/api/contact-qr"} alt={t.contact.qr} style={{ width: 140, marginTop: "0.75rem" }} />
        )}
        {form.hasContactQr && (
          <label className="row" style={{ marginTop: "0.5rem" }}>
            <input type="checkbox" checked={clearQr} onChange={(event) => setClearQr(event.target.checked)} />
            {t.admin.clearQr}
          </label>
        )}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? t.common.loading : t.admin.saveSettings}
      </button>
      {saved && <div className="alert alert-mock" role="status">{t.common.saved}</div>}
    </form>
  );
}
