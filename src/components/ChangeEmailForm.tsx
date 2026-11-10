"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const zh = useDict();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        const next = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
          setError(zh.auth.emailInvalid);
          return;
        }
        setBusy(true);
        try {
          if (!sentTo || sentTo !== next.toLowerCase()) {
            const res = await fetch("/api/account/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: next }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(typeof data.error === "string" && data.error ? data.error : zh.auth.sendFailed);
              return;
            }
            setSentTo(typeof data.email === "string" ? data.email : next.toLowerCase());
            setMessage(typeof data.message === "string" ? data.message : zh.security.emailCodeSent);
            return;
          }
          if (!/^\d{6}$/.test(code.trim())) {
            setError(zh.auth.invalidCode);
            return;
          }
          const res = await fetch("/api/account/email/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: next, code: code.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.auth.invalidCode);
            return;
          }
          setMessage(typeof data.message === "string" ? data.message : zh.security.emailChanged);
          setCode("");
          setSentTo("");
          setEmail("");
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.security.changeEmail}</h2>
      <p className="muted" style={{ margin: 0 }}>{zh.security.changeEmailLead}</p>
      <p className="muted" style={{ margin: 0 }}>{currentEmail}</p>
      <div>
        <label className="label" htmlFor="new-email">{zh.security.newEmail}</label>
        <input
          id="new-email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSentTo("");
          }}
        />
      </div>
      {sentTo && (
        <div>
          <label className="label" htmlFor="email-code">{zh.auth.code}</label>
          <input
            id="email-code"
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-info" role="status">{message}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? zh.common.loading : sentTo ? zh.security.confirmEmail : zh.security.sendEmailCode}
      </button>
    </form>
  );
}
