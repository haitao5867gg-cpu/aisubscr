"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminProductForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceYuan, setPriceYuan] = useState("9.90");
  const [isSubscription, setIsSubscription] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            priceCents: Math.round(parseFloat(priceYuan) * 100),
            isSubscription,
          }),
        });
        setName("");
        setDescription("");
        router.refresh();
      }}
    >
      <h3 style={{ margin: 0 }}>新增商品</h3>
      <input className="input" placeholder="名称" required value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="textarea" placeholder="描述" required value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className="input" placeholder="价格（元）" value={priceYuan} onChange={(e) => setPriceYuan(e.target.value)} />
      <label className="row">
        <input type="checkbox" checked={isSubscription} onChange={(e) => setIsSubscription(e.target.checked)} />
        可按月续费
      </label>
      <button className="btn btn-primary" type="submit">
        保存
      </button>
    </form>
  );
}
