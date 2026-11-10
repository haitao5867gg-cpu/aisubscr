"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

type ProductSeed = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  isSubscription: boolean;
  active: boolean;
  imageUrl: string | null;
  stock: number | null;
  sortOrder: number;
};

export function AdminProductForm({ product }: { product?: ProductSeed }) {
  const zh = useDict();
  const router = useRouter();
  const prefix = product?.id ?? "new";
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceYuan, setPriceYuan] = useState(product ? (product.priceCents / 100).toFixed(2) : "9.90");
  const [stock, setStock] = useState(product?.stock === null || product?.stock === undefined ? "" : String(product.stock));
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isSubscription, setIsSubscription] = useState(product?.isSubscription ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function field(id: string) {
    return `${prefix}-${id}`;
  }

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        const price = Number(priceYuan);
        if (!name.trim() || !description.trim()) {
          setError(zh.common.fieldRequired);
          return;
        }
        if (!Number.isFinite(price) || price <= 0) {
          setError(zh.shop.priceInvalid);
          return;
        }
        const image = imageUrl.trim();
        if (image && (!image.startsWith("/") || image.startsWith("//") || image.includes(".."))) {
          setError(zh.admin.imageInvalid);
          return;
        }
        const sort = Number(sortOrder);
        if (!Number.isInteger(sort)) {
          setError(zh.admin.invalidProduct);
          return;
        }
        let stockValue: number | null = null;
        if (stock.trim() !== "") {
          stockValue = Number(stock);
          if (!Number.isInteger(stockValue) || stockValue < 0) {
            setError(zh.admin.invalidProduct);
            return;
          }
        }
        setBusy(true);
        try {
          const payload = {
            name: name.trim(),
            description: description.trim(),
            priceCents: Math.round(price * 100),
            isSubscription,
            active,
            imageUrl: image,
            stock: stockValue,
            sortOrder: sort,
          };
          const res = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
            method: product ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
            return;
          }
          if (!product) {
            setName("");
            setDescription("");
            setImageUrl("");
            setStock("");
            setSortOrder("0");
            setIsSubscription(false);
            setActive(true);
          }
          setMessage(zh.common.saved);
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{product ? zh.admin.edit : zh.admin.newProduct}</h2>
      <div>
        <label className="label" htmlFor={field("name")}>{zh.admin.name}</label>
        <input id={field("name")} className="input" required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={field("description")}>{zh.admin.description}</label>
        <textarea id={field("description")} className="textarea" required value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="filter-bar" style={{ padding: 0 }}>
        <div>
          <label className="label" htmlFor={field("price")}>{zh.admin.priceYuan}</label>
          <input id={field("price")} className="input" inputMode="decimal" required value={priceYuan} onChange={(event) => setPriceYuan(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={field("stock")}>{zh.admin.stock}</label>
          <input id={field("stock")} className="input" inputMode="numeric" value={stock} placeholder={zh.admin.stockHint} onChange={(event) => setStock(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={field("sort")}>{zh.admin.sortOrder}</label>
          <input id={field("sort")} className="input" inputMode="numeric" required value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={field("image")}>{zh.admin.image}</label>
        <input id={field("image")} className="input" value={imageUrl} placeholder="/images/plan.png" onChange={(event) => setImageUrl(event.target.value)} />
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>{zh.admin.imageHint}</p>
      </div>
      <label className="row">
        <input type="checkbox" checked={isSubscription} onChange={(event) => setIsSubscription(event.target.checked)} />
        {zh.admin.subscription}
      </label>
      <label className="row">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        {zh.admin.visible}
      </label>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-info" role="status">{message}</div>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? zh.common.loading : zh.admin.save}
        </button>
        {product && (
          <button
            className="btn btn-danger"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setMessage("");
              try {
                const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
                  return;
                }
                setMessage(data.hidden ? zh.admin.hiddenBecauseOrdered : zh.admin.removed);
                router.refresh();
              } catch {
                setError(zh.common.requestFailed);
              } finally {
                setBusy(false);
              }
            }}
          >
            {zh.admin.remove}
          </button>
        )}
      </div>
    </form>
  );
}
