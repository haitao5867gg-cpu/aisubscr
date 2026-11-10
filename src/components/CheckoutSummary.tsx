"use client";

import { useState } from "react";
import Link from "next/link";
import { useDict } from "@/components/LocaleProvider";
import { formatRmb } from "@/lib/money";
import { CheckoutButton } from "./CheckoutButton";

export function CheckoutSummary({ subtotalCents, loggedIn }: { subtotalCents: number; loggedIn: boolean }) {
  const t = useDict();
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const payable = Math.max(0, subtotalCents - discountCents);

  async function apply() {
    const next = code.trim();
    setError("");
    if (!next) {
      setError(t.coupon.invalid);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplied("");
        setDiscountCents(0);
        setError(typeof data.error === "string" && data.error ? data.error : t.coupon.invalid);
        return;
      }
      setApplied(data.quote?.code || next.toUpperCase());
      setDiscountCents(Number(data.quote?.discountCents) || 0);
      setCode(data.quote?.code || next.toUpperCase());
    } catch {
      setError(t.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="money-row">
        <span className="muted">{t.order.subtotal}</span>
        <span>{formatRmb(subtotalCents)}</span>
      </div>
      <div>
        <label className="label" htmlFor="coupon-code">
          {t.coupon.label}
        </label>
        <div className="row">
          <input
            id="coupon-code"
            className="input"
            value={code}
            autoComplete="off"
            placeholder={t.coupon.placeholder}
            onChange={(event) => {
              setCode(event.target.value);
              if (applied) {
                setApplied("");
                setDiscountCents(0);
              }
            }}
          />
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={apply}>
            {busy ? t.common.loading : t.coupon.apply}
          </button>
        </div>
      </div>
      {applied && discountCents > 0 && (
        <div className="money-row">
          <span className="muted">{t.coupon.applied.replace("{code}", applied)}</span>
          <strong>-{formatRmb(discountCents)}</strong>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <div className="money-row" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
        <span>{t.shop.payable}</span>
        <strong className="plan-price" style={{ fontSize: "1.45rem" }}>
          {formatRmb(payable)}
        </strong>
      </div>
      <div className="alert alert-mock">{t.payment.mockNote}</div>
      {loggedIn ? (
        <CheckoutButton label={t.shop.placeOrder} couponCode={applied || code.trim()} />
      ) : (
        <Link href="/login?next=/cart" className="btn btn-primary">
          {t.shop.loginToPlace}
        </Link>
      )}
    </div>
  );
}
