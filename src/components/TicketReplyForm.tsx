"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zh } from "@/i18n/zh";

export function TicketReplyForm({ ticketId, admin = false }: { ticketId: string; admin?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const url = admin ? `/api/admin/tickets/${ticketId}/reply` : `/api/tickets/${ticketId}/reply`;

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        setBody("");
        setBusy(false);
        router.refresh();
      }}
    >
      <textarea className="textarea" required value={body} onChange={(e) => setBody(e.target.value)} placeholder={zh.ticket.reply} />
      <button className="btn btn-primary" disabled={busy} type="submit">
        {zh.ticket.reply}
      </button>
    </form>
  );
}
