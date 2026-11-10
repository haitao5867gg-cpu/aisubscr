"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

const STATUSES = ["OPEN", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;

export function AdminTicketControls({
  ticketId,
  status,
  assigneeId,
  admins,
}: {
  ticketId: string;
  status: string;
  assigneeId: string | null;
  admins: { id: string; label: string }[];
}) {
  const t = useDict();
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [assignee, setAssignee] = useState(assigneeId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="card filter-bar"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          const res = await fetch(`/api/admin/tickets/${ticketId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: nextStatus,
              assigneeId: assignee || null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : t.admin.actionFailed);
            return;
          }
          setSaved(true);
          router.refresh();
        } catch {
          setError(t.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="ticket-status">{t.admin.filterStatus}</label>
        <select id="ticket-status" className="select" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
          {STATUSES.map((item) => (
            <option key={item} value={item}>{t.ticket.status[item]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ticket-assignee">{t.ticket.assign}</label>
        <select id="ticket-assignee" className="select" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option value="">{t.ticket.unassigned}</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>{admin.label}</option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? t.common.loading : t.ticket.saveTicket}
      </button>
      {saved && <p className="muted" role="status" style={{ margin: 0 }}>{t.admin.ticketSaved}</p>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
    </form>
  );
}
