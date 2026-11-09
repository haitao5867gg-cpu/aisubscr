"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zh } from "@/i18n/zh";

export function TicketForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, subject, body }),
        });
        const data = await res.json();
        setBusy(false);
        if (res.ok) {
          router.push(`/tickets/${data.ticket.id}`);
          router.refresh();
        } else {
          alert(data.error || "提交失败");
        }
      }}
    >
      <h3 style={{ margin: 0 }}>{zh.order.createTicket}</h3>
      <div>
        <label className="label">{zh.ticket.subject}</label>
        <input className="input" required value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="label">{zh.ticket.body}</label>
        <textarea className="textarea" required value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <button className="btn btn-primary" disabled={busy} type="submit">
        {zh.common.submit}
      </button>
    </form>
  );
}
