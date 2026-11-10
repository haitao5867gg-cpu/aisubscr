"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function AuthForm({
  mode,
  next = "/",
  initialEmail = "",
}: {
  mode: "login" | "register";
  next?: string;
  initialEmail?: string;
}) {
  const zh = useDict();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(zh.auth.emailInvalid);
      return;
    }
    if (!password) {
      setError(zh.common.fieldRequired);
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError(zh.auth.passwordShort);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email: trimmed, password, ...(needsTotp ? { totp: totp.trim() } : {}) }
            : { email: trimmed, password, name },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (data.totpRequired) {
        setNeedsTotp(true);
        setError(typeof data.error === "string" ? data.error : zh.auth.totpPrompt);
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : zh.common.requestFailed);
        return;
      }
      const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.push(dest);
      router.refresh();
    } catch {
      setError(zh.common.requestFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card stack auth-card">
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="auth-name">{zh.auth.name}</label>
          <input id="auth-name" className="input" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="auth-email">{zh.auth.email}</label>
        <input
          id="auth-email"
          className="input"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(error)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="auth-password">{zh.auth.password}</label>
        <input
          id="auth-password"
          className="input"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          aria-invalid={Boolean(error)}
          minLength={mode === "register" ? 6 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "login" && (
          <p className="muted" style={{ textAlign: "right", margin: "0.45rem 0 0" }}>
            <Link href={`/forgot-password?next=${encodeURIComponent(next.startsWith("/") && !next.startsWith("//") ? next : "/")}`}>
              {zh.auth.forgotPassword}
            </Link>
          </p>
        )}
      </div>
      {mode === "login" && needsTotp && (
        <div>
          <label className="label" htmlFor="auth-totp">{zh.auth.totpCode}</label>
          <input
            id="auth-totp"
            className="input"
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            value={totp}
            onChange={(event) => setTotp(event.target.value)}
          />
          <p className="muted" style={{ margin: "0.45rem 0 0" }}>{zh.auth.totpHint}</p>
        </div>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? zh.common.loading : mode === "login" ? zh.auth.loginTitle : zh.auth.registerTitle}
      </button>
    </form>
  );
}
