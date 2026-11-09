"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zh } from "@/i18n/zh";

export function AuthForm({ mode, next = "/" }: { mode: "login" | "register"; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "login" ? { email, password } : { email, password, name }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "失败");
      return;
    }
    const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.push(dest);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card stack auth-card">
      <h1 className="page-title">{mode === "login" ? zh.auth.loginTitle : zh.auth.registerTitle}</h1>
      {mode === "register" && (
        <div>
          <label className="label">{zh.auth.name}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label">{zh.auth.email}</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">{zh.auth.password}</label>
        <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <div className="alert" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</div>}
      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? zh.common.loading : mode === "login" ? zh.auth.loginTitle : zh.auth.registerTitle}
      </button>
    </form>
  );
}
