"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { uploadAdminImage } from "@/lib/upload-client";

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
  adminTotpRequired: boolean;
  adminNotifyEmail: string;
  notifyPaidOrders: boolean;
  notifyNewTickets: boolean;
  notifyLowStock: boolean;
  qrImageUrl: string;
  hasContactQr: boolean;
};

export function AdminSettingsForm({ initial }: { initial: Settings }) {
  const t = useDict();
  const router = useRouter();
  const [form, setForm] = useState(initial);
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
        if (form.adminNotifyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminNotifyEmail.trim())) {
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
              adminTotpRequired: form.adminTotpRequired,
              adminNotifyEmail: form.adminNotifyEmail.trim(),
              notifyPaidOrders: form.notifyPaidOrders,
              notifyNewTickets: form.notifyNewTickets,
              notifyLowStock: form.notifyLowStock,
              ...(clearQr ? { clearQr: true } : {}),
              ...(form.qrImageUrl && !clearQr ? { qrImageUrl: form.qrImageUrl } : {}),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : t.admin.actionFailed);
            return;
          }
          setSaved(true);
          setClearQr(false);
          if (clearQr) {
            setField("qrImageUrl", "");
            setField("hasContactQr", false);
          }
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
        <label className="label" htmlFor="setting-notify">{t.admin.adminNotifyEmail}</label>
        <input
          id="setting-notify"
          className="input"
          type="email"
          value={form.adminNotifyEmail}
          onChange={(event) => setField("adminNotifyEmail", event.target.value)}
        />
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>{t.admin.notifyHint}</p>
        <label className="row" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={form.notifyPaidOrders}
            onChange={(event) => setField("notifyPaidOrders", event.target.checked)}
          />
          {t.admin.notifyPaidOrders}
        </label>
        <label className="row" style={{ marginTop: "0.35rem" }}>
          <input
            type="checkbox"
            checked={form.notifyNewTickets}
            onChange={(event) => setField("notifyNewTickets", event.target.checked)}
          />
          {t.admin.notifyNewTickets}
        </label>
        <label className="row" style={{ marginTop: "0.35rem" }}>
          <input
            type="checkbox"
            checked={form.notifyLowStock}
            onChange={(event) => setField("notifyLowStock", event.target.checked)}
          />
          {t.admin.notifyLowStock}
        </label>
      </div>
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
        <label className="row">
          <input
            type="checkbox"
            checked={form.adminTotpRequired}
            onChange={(event) => setField("adminTotpRequired", event.target.checked)}
          />
          {t.admin.totpRequiredSetting}
        </label>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>{t.admin.totpRequiredHint}</p>
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
            event.target.value = "";
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              setError(t.admin.uploadInvalid);
              return;
            }
            setError("");
            setBusy(true);
            void uploadAdminImage(file, "contact-qr")
              .then((url) => {
                setClearQr(false);
                setField("qrImageUrl", url);
                setField("hasContactQr", true);
              })
              .catch((uploadError: unknown) => {
                setError(uploadError instanceof Error && uploadError.message ? uploadError.message : t.admin.uploadFailed);
              })
              .finally(() => setBusy(false));
          }}
        />
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>{t.admin.qrHint}</p>
        {(form.qrImageUrl || form.hasContactQr) && !clearQr && (
          // Uploaded files are WebP on our host or R2. The legacy QR is same-origin.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.qrImageUrl || "/api/contact-qr"}
            alt={t.contact.qr}
            style={{ width: 140, maxWidth: "100%", marginTop: "0.75rem" }}
          />
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
