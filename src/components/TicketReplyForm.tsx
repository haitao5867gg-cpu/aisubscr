"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { uploadTicketImage } from "@/lib/upload-client";

export function TicketReplyForm({ ticketId, admin = false }: { ticketId: string; admin?: boolean }) {
  const zh = useDict();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = admin ? `/api/admin/tickets/${ticketId}/reply` : `/api/tickets/${ticketId}/reply`;
  const fieldId = `reply-${ticketId}`;

  return (
    <form
      className="stack"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
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
            body: JSON.stringify({
              body: body.trim(),
              ...(admin ? { internal } : {}),
              ...(attachments.length ? { attachments } : {}),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.shop.replyFailed);
            return;
          }
          setBody("");
          setInternal(false);
          setAttachments([]);
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="label" htmlFor={fieldId}>{admin && internal ? zh.ticket.internal : zh.ticket.reply}</label>
      <textarea id={fieldId} className="textarea" required maxLength={4000} aria-invalid={Boolean(error)} value={body} onChange={(event) => setBody(event.target.value)} />
      <p className="muted" style={{ margin: 0 }}>{admin && internal ? zh.ticket.internalHint : zh.ticket.replyHint}</p>
      {admin && (
        <label className="row" style={{ margin: 0 }}>
          <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
          {zh.ticket.internal}
        </label>
      )}
      <div>
        <label className="label" htmlFor={`${fieldId}-files`}>{zh.ticket.attachments}</label>
        <input
          id={`${fieldId}-files`}
          className="input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || attachments.length >= 4) return;
            if (file.size > 5 * 1024 * 1024) {
              setError(zh.ticket.uploadInvalid);
              return;
            }
            setBusy(true);
            setError("");
            void uploadTicketImage(file)
              .then((uploaded) => setAttachments((current) => [...current, uploaded].slice(0, 4)))
              .catch((uploadError: unknown) => {
                setError(uploadError instanceof Error && uploadError.message ? uploadError.message : zh.ticket.uploadInvalid);
              })
              .finally(() => setBusy(false));
          }}
        />
        {attachments.length > 0 && (
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>{attachments.length} / 4</p>
        )}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit">
        {busy ? zh.common.loading : admin && internal ? zh.ticket.internal : zh.ticket.reply}
      </button>
    </form>
  );
}
