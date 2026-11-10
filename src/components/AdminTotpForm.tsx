"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

type Enrollment = {
  secret: string;
  qrDataUrl: string;
};

export function AdminTotpForm({ enabled, required }: { enabled: boolean; required: boolean }) {
  const t = useDict();
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/totp/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.secret !== "string" || typeof data.qrDataUrl !== "string") {
        setError(typeof data.error === "string" && data.error ? data.error : t.common.requestFailed);
        return;
      }
      setEnrollment({ secret: data.secret, qrDataUrl: data.qrDataUrl });
      setCode("");
    } catch {
      setError(t.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!code.trim()) {
      setError(t.auth.totpPrompt);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.recoveryCodes)) {
        setError(typeof data.error === "string" && data.error ? data.error : t.auth.totpInvalid);
        return;
      }
      setRecoveryCodes(data.recoveryCodes.filter((item: unknown) => typeof item === "string"));
      setOn(true);
      setEnrollment(null);
      setCode("");
      router.refresh();
    } catch {
      setError(t.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!password || !disableCode.trim()) {
      setError(t.common.fieldRequired);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code: disableCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : t.admin.totpMismatch);
        return;
      }
      setOn(false);
      setRecoveryCodes(null);
      setPassword("");
      setDisableCode("");
      router.refresh();
    } catch {
      setError(t.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div className="card stack" style={{ padding: "1.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{t.admin.totpTitle}</h2>
        <p className="muted" style={{ margin: 0 }}>{on ? t.admin.totpEnabled : t.admin.totpDisabledState}</p>
        {!on && !enrollment && (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void start()}>
            {busy ? t.common.loading : t.admin.totpStart}
          </button>
        )}
        {!on && enrollment && (
          <form className="stack" onSubmit={confirm} noValidate>
            <p className="muted" style={{ margin: 0 }}>{t.admin.totpScan}</p>
            {/* QR is a data URL of the otpauth payload. next/image does not accept that. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrDataUrl} alt={t.admin.totpTitle} style={{ width: 220, maxWidth: "100%", height: "auto" }} />
            <div>
              <div className="label">{t.admin.totpSecret}</div>
              <code data-testid="totp-secret" style={{ overflowWrap: "anywhere" }}>{enrollment.secret}</code>
            </div>
            <div>
              <label className="label" htmlFor="totp-confirm-code">{t.auth.totpCode}</label>
              <input
                id="totp-confirm-code"
                className="input"
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? t.common.loading : t.admin.totpConfirm}
            </button>
          </form>
        )}
        {recoveryCodes && (
          <div>
            <p style={{ marginTop: 0 }}>{t.admin.totpRecoveryLead}</p>
            <ul data-testid="recovery-codes" className="plain-list" style={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>
              {recoveryCodes.map((item) => (
                <li key={item} data-testid="recovery-code">{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {on && (
        <form className="card stack" style={{ padding: "1.25rem" }} onSubmit={disable} noValidate>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{t.admin.totpDisable}</h2>
          <p className="muted" style={{ margin: 0 }}>{t.admin.totpDisableLead}</p>
          {required && <p className="muted" style={{ margin: 0 }}>{t.admin.totpDisableRequired}</p>}
          <div>
            <label className="label" htmlFor="totp-disable-password">{t.admin.totpPassword}</label>
            <input
              id="totp-disable-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="totp-disable-code">{t.auth.totpCode}</label>
            <input
              id="totp-disable-code"
              className="input"
              autoComplete="one-time-code"
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
            />
          </div>
          <button className="btn btn-danger" type="submit" disabled={busy}>
            {busy ? t.common.loading : t.admin.totpDisable}
          </button>
        </form>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
    </div>
  );
}
