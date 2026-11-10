"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { normalizeEmail } from "@/lib/email";

const REDIRECT_DELAY_MS = 1400;

function registerHref(email: string, next: string) {
  const params = new URLSearchParams();
  params.set("email", email);
  if (next.startsWith("/") && !next.startsWith("//")) params.set("next", next);
  return `/register?${params.toString()}`;
}

export function ForgotPasswordForm({ loginHref, next }: { loginHref: string; next: string }) {
  const zh = useDict();
  const router = useRouter();
  const redirectTimer = useRef<number | null>(null);
  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    };
  }, []);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (redirecting) return;
    setLoading(true);
    setError("");
    setInfo("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" && data.error ? data.error : zh.auth.sendFailed);
      return;
    }
    if (data.status === "not_registered") {
      const target = normalizeEmail(typeof data.email === "string" && data.email ? data.email : email);
      setInfo(typeof data.message === "string" && data.message ? data.message : zh.auth.notRegistered);
      setRedirecting(true);
      redirectTimer.current = window.setTimeout(() => {
        router.push(registerHref(target, next));
      }, REDIRECT_DELAY_MS);
      return;
    }
    if (data.ok === true && data.status === "sent") {
      const sentTo = normalizeEmail(typeof data.email === "string" && data.email ? data.email : email);
      const fallback = zh.auth.codeSent.replaceAll("{email}", sentTo);
      setInfo(typeof data.message === "string" && data.message ? data.message : fallback);
      setStep("confirm");
      return;
    }
    setError(zh.auth.sendFailed);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || zh.auth.invalidCode);
      return;
    }
    setInfo(data.message || zh.auth.resetDone);
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="card stack auth-card">
        <div className="alert alert-info">{info}</div>
        <Link className="btn btn-primary" href={loginHref}>
          {zh.auth.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={step === "request" ? sendCode : reset} noValidate className="card stack auth-card">
      <div>
        <label className="label" htmlFor="reset-email">{zh.auth.email}</label>
        <input
          id="reset-email"
          className="input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={redirecting}
        />
      </div>
      {step === "confirm" && (
        <>
          <div>
            <label className="label" htmlFor="reset-code">{zh.auth.code}</label>
            <input
              id="reset-code"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="reset-password">{zh.auth.newPassword}</label>
            <input
              id="reset-password"
              className="input"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </>
      )}
      {info && <div className="alert alert-info">{info}</div>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <button className="btn btn-primary" disabled={loading || redirecting} type="submit">
        {loading ? zh.common.loading : step === "request" ? zh.auth.sendCode : zh.auth.resetAction}
      </button>
      {step === "confirm" && (
        <button className="btn btn-ghost" disabled={loading} type="button" onClick={() => sendCode()}>
          {zh.auth.resendCode}
        </button>
      )}
    </form>
  );
}
