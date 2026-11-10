"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { toShanghaiInput } from "@/lib/shanghai-input";
import { yuanToCents } from "@/lib/money";

type Coupon = {
  id: string;
  code: string;
  kind: string;
  percentOff: number | null;
  amountCents: number | null;
  minOrderCents: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  active: boolean;
  updatedAt: string;
};

function centsToYuan(cents: number | null) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function CouponEditor({ coupon }: { coupon?: Coupon }) {
  const t = useDict();
  const router = useRouter();
  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<"PERCENT" | "FIXED">(coupon?.kind === "FIXED" ? "FIXED" : "PERCENT");
  const [percentOff, setPercentOff] = useState(coupon?.percentOff ? String(coupon.percentOff) : "10");
  const [amountYuan, setAmountYuan] = useState(centsToYuan(coupon?.amountCents ?? null));
  const [minYuan, setMinYuan] = useState(coupon ? centsToYuan(coupon.minOrderCents) : "0");
  const [startsAt, setStartsAt] = useState(coupon?.startsAt ? toShanghaiInput(new Date(coupon.startsAt)) : "");
  const [endsAt, setEndsAt] = useState(coupon?.endsAt ? toShanghaiInput(new Date(coupon.endsAt)) : "");
  const [maxUses, setMaxUses] = useState(coupon?.maxUses == null ? "" : String(coupon.maxUses));
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(coupon?.maxUsesPerUser == null ? "" : String(coupon.maxUsesPerUser));
  const [active, setActive] = useState(coupon?.active ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function optionalInt(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  async function save() {
    setError("");
    const min = yuanToCents(Number(minYuan || "0"));
    const amount = yuanToCents(Number(amountYuan || "0"));
    const percent = Number(percentOff);
    const uses = optionalInt(maxUses);
    const perUser = optionalInt(maxUsesPerUser);
    if (!code.trim() || !Number.isInteger(min) || min < 0 || Number.isNaN(uses) || Number.isNaN(perUser)) {
      setError(t.admin.invalidCoupon);
      return;
    }
    if (kind === "PERCENT" && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
      setError(t.admin.invalidCoupon);
      return;
    }
    if (kind === "FIXED" && (!Number.isInteger(amount) || amount < 1)) {
      setError(t.admin.invalidCoupon);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons", {
        method: coupon ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          kind,
          percentOff: kind === "PERCENT" ? percent : null,
          amountCents: kind === "FIXED" ? amount : null,
          minOrderCents: min,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          maxUses: uses,
          maxUsesPerUser: perUser,
          active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" && data.error ? data.error : t.admin.invalidCoupon);
        return;
      }
      if (!coupon) {
        setCode("");
        setAmountYuan("");
        setStartsAt("");
        setEndsAt("");
        setMaxUses("");
        setMaxUsesPerUser("");
      }
      router.refresh();
    } catch {
      setError(t.common.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card stack"
      style={{ padding: "1rem" }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {coupon && (
        <div className="muted">
          {t.admin.used} {coupon.usedCount}
          {coupon.maxUses != null ? ` / ${coupon.maxUses}` : ""}
        </div>
      )}
      <div>
        <label className="label" htmlFor={coupon ? `code-${coupon.id}` : "code-new"}>{t.admin.code}</label>
        <input id={coupon ? `code-${coupon.id}` : "code-new"} className="input" value={code} onChange={(event) => setCode(event.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor={coupon ? `kind-${coupon.id}` : "kind-new"}>{t.admin.kind}</label>
        <select id={coupon ? `kind-${coupon.id}` : "kind-new"} className="select" value={kind} onChange={(event) => setKind(event.target.value === "FIXED" ? "FIXED" : "PERCENT")}>
          <option value="PERCENT">{t.admin.percentOff}</option>
          <option value="FIXED">{t.admin.amountOff}</option>
        </select>
      </div>
      {kind === "PERCENT" ? (
        <div>
          <label className="label" htmlFor={coupon ? `pct-${coupon.id}` : "pct-new"}>{t.admin.percentOff}</label>
          <input id={coupon ? `pct-${coupon.id}` : "pct-new"} className="input" inputMode="numeric" value={percentOff} onChange={(event) => setPercentOff(event.target.value)} />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor={coupon ? `amt-${coupon.id}` : "amt-new"}>{t.admin.amountOff}</label>
          <input id={coupon ? `amt-${coupon.id}` : "amt-new"} className="input" inputMode="decimal" value={amountYuan} onChange={(event) => setAmountYuan(event.target.value)} />
        </div>
      )}
      <div>
        <label className="label" htmlFor={coupon ? `min-${coupon.id}` : "min-new"}>{t.admin.minOrder}</label>
        <input id={coupon ? `min-${coupon.id}` : "min-new"} className="input" inputMode="decimal" value={minYuan} onChange={(event) => setMinYuan(event.target.value)} />
      </div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor={coupon ? `start-${coupon.id}` : "start-new"}>{t.admin.startsAt}</label>
          <input id={coupon ? `start-${coupon.id}` : "start-new"} className="input" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor={coupon ? `end-${coupon.id}` : "end-new"}>{t.admin.endsAt}</label>
          <input id={coupon ? `end-${coupon.id}` : "end-new"} className="input" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t.admin.timeHint}</p>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor={coupon ? `uses-${coupon.id}` : "uses-new"}>{t.admin.maxUses}</label>
          <input id={coupon ? `uses-${coupon.id}` : "uses-new"} className="input" inputMode="numeric" placeholder={t.admin.unlimited} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor={coupon ? `user-${coupon.id}` : "user-new"}>{t.admin.maxUsesPerUser}</label>
          <input id={coupon ? `user-${coupon.id}` : "user-new"} className="input" inputMode="numeric" placeholder={t.admin.unlimited} value={maxUsesPerUser} onChange={(event) => setMaxUsesPerUser(event.target.value)} />
        </div>
      </div>
      <label className="row" style={{ margin: 0 }}>
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        {t.admin.active}
      </label>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t.common.loading : coupon ? t.admin.save : t.admin.newCoupon}
        </button>
        {coupon && <DeleteCoupon id={coupon.id} />}
      </div>
    </form>
  );
}

function DeleteCoupon({ id }: { id: string }) {
  const t = useDict();
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className="stack" style={{ gap: "0.35rem" }}>
      <button
        type="button"
        className="btn btn-danger"
        onClick={async () => {
          setError("");
          const res = await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : t.admin.actionFailed);
            return;
          }
          router.refresh();
        }}
      >
        {t.admin.remove}
      </button>
      {error && <span className="muted">{error}</span>}
    </div>
  );
}

export function AdminCouponForm({ coupons }: { coupons: Coupon[] }) {
  const t = useDict();
  return (
    <div className="stack">
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{t.admin.newCoupon}</h2>
      <CouponEditor />
      {coupons.map((coupon) => (
        <CouponEditor key={`${coupon.id}-${coupon.updatedAt}`} coupon={coupon} />
      ))}
    </div>
  );
}
