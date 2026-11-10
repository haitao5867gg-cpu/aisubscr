"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function TicketForm({ orderId }: { orderId: string }) {
  const zh = useDict();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!subject.trim() || !body.trim()) {
          setError(zh.common.fieldRequired);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, subject: subject.trim(), body: body.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.shop.ticketFailed);
            return;
          }
          router.push(`/tickets/${data.ticket.id}`);
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.order.createTicket}</h2>
      <div>
        <label className="label" htmlFor="ticket-subject">{zh.ticket.subject}</label>
        <input id="ticket-subject" className="input" required aria-invalid={Boolean(error)} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ticket-body">{zh.ticket.body}</label>
        <textarea id="ticket-body" className="textarea" required aria-invalid={Boolean(error)} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit">
        {busy ? zh.common.loading : zh.common.submit}
      </button>
    </form>
  );
}
