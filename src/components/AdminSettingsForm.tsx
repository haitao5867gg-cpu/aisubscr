"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  siteName: string;
  supportEmail: string;
  supportHours: string;
  footerText: string;
};

export function AdminSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem", maxWidth: 560 }}
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setSaved(true);
        router.refresh();
      }}
    >
      {(["siteName", "supportEmail", "supportHours", "footerText"] as const).map((key) => (
        <div key={key}>
          <label className="label">{key}</label>
          <input
            className="input"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
      <button className="btn btn-primary" type="submit">
        保存设置
      </button>
      {saved && <div className="alert alert-mock">已保存</div>}
    </form>
  );
}
