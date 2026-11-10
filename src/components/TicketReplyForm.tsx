"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function TicketReplyForm({ ticketId, admin = false }: { ticketId: string; admin?: boolean }) {
  const zh = useDict();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = admin ? `/api/admin/tickets/${ticketId}/reply` : `/api/tickets/${ticketId}/reply`;

  return (
    <form
      className="stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!body.trim()) {
          setError(zh.common.fieldRequired);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: body.trim() }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.shop.replyFailed);
            return;
          }
          setBody("");
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="label" htmlFor={`reply-${ticketId}`}>{zh.ticket.reply}</label>
      <textarea id={`reply-${ticketId}`} className="textarea" required aria-invalid={Boolean(error)} value={body} onChange={(e) => setBody(e.target.value)} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit">
        {busy ? zh.common.loading : zh.ticket.reply}
      </button>
    </form>
  );
}
