"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function AdminProductForm() {
  const zh = useDict();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceYuan, setPriceYuan] = useState("9.90");
  const [isSubscription, setIsSubscription] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const price = Number(priceYuan);
        if (!name.trim() || !description.trim()) {
          setError(zh.common.fieldRequired);
          return;
        }
        if (!Number.isFinite(price) || price <= 0) {
          setError(zh.shop.priceInvalid);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/admin/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim(),
              priceCents: Math.round(price * 100),
              isSubscription,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
            return;
          }
          setName("");
          setDescription("");
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.admin.newProduct}</h2>
      <div>
        <label className="label" htmlFor="product-name">{zh.admin.name}</label>
        <input id="product-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="product-description">{zh.admin.description}</label>
        <textarea id="product-description" className="textarea" required value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="product-price">{zh.admin.priceYuan}</label>
        <input id="product-price" className="input" inputMode="decimal" required value={priceYuan} onChange={(e) => setPriceYuan(e.target.value)} />
      </div>
      <label className="row">
        <input type="checkbox" checked={isSubscription} onChange={(e) => setIsSubscription(e.target.checked)} />
        {zh.admin.subscription}
      </label>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? zh.common.loading : zh.admin.save}
      </button>
    </form>
  );
}
