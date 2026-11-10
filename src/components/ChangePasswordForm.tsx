"use client";

import { useState } from "react";
import { useDict } from "@/components/LocaleProvider";

export function ChangePasswordForm() {
  const zh = useDict();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
        if (!currentPassword || !newPassword) {
          setError(zh.common.fieldRequired);
          return;
        }
        if (newPassword.length < 6) {
          setError(zh.auth.passwordShort);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError(zh.security.passwordMismatch);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/account/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.common.requestFailed);
            return;
          }
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setMessage(typeof data.message === "string" ? data.message : zh.security.passwordChanged);
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.security.changePassword}</h2>
      <div>
        <label className="label" htmlFor="current-password">{zh.security.currentPassword}</label>
        <input
          id="current-password"
          className="input"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="new-password">{zh.security.newPassword}</label>
        <input
          id="new-password"
          className="input"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">{zh.security.confirmPassword}</label>
        <input
          id="confirm-password"
          className="input"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-info" role="status">{message}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? zh.common.loading : zh.security.changePassword}
      </button>
    </form>
  );
}
