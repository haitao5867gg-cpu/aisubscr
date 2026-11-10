"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { uploadTicketImage } from "@/lib/upload-client";

const CATEGORIES = ["order", "billing", "account", "technical", "other"] as const;

export function TicketForm({
  orderId,
  orders = [],
}: {
  orderId?: string;
  orders?: { id: string; orderNo: string }[];
}) {
  const zh = useDict();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(orderId ? "order" : "other");
  const [linkedOrder, setLinkedOrder] = useState(orderId ?? "");
  const [attachments, setAttachments] = useState<{ url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = 4 - attachments.length;
    if (room <= 0) {
      setError(zh.ticket.attachHint);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = [...attachments];
      for (const file of Array.from(list).slice(0, room)) {
        if (file.size > 5 * 1024 * 1024) {
          setError(zh.ticket.uploadInvalid);
          continue;
        }
        const url = await uploadTicketImage(file);
        next.push({ url });
      }
      setAttachments(next);
    } catch (uploadError) {
      setError(uploadError instanceof Error && uploadError.message ? uploadError.message : zh.ticket.uploadInvalid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
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
            body: JSON.stringify({
              subject: subject.trim(),
              body: body.trim(),
              category,
              ...(linkedOrder ? { orderId: linkedOrder } : {}),
              ...(attachments.length ? { attachments: attachments.map((item) => item.url) } : {}),
            }),
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
        <input id="ticket-subject" className="input" required maxLength={120} aria-invalid={Boolean(error)} value={subject} onChange={(event) => setSubject(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ticket-category">{zh.ticket.category}</label>
        <select id="ticket-category" className="select" value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>{zh.ticket.categories[item]}</option>
          ))}
        </select>
      </div>
      {!orderId && orders.length > 0 && (
        <div>
          <label className="label" htmlFor="ticket-order">{zh.ticket.order}</label>
          <select id="ticket-order" className="select" value={linkedOrder} onChange={(event) => setLinkedOrder(event.target.value)}>
            <option value="">{zh.ticket.noOrder}</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>{order.orderNo}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="ticket-body">{zh.ticket.body}</label>
        <textarea id="ticket-body" className="textarea" required maxLength={4000} aria-invalid={Boolean(error)} value={body} onChange={(event) => setBody(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="ticket-files">{zh.ticket.attachments}</label>
        <input
          id="ticket-files"
          className="input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => {
            const files = event.target.files;
            event.target.value = "";
            void addFiles(files);
          }}
        />
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>{zh.ticket.attachHint}</p>
        {attachments.length > 0 && (
          <ul className="stack" style={{ margin: "0.6rem 0 0", padding: 0, listStyle: "none" }}>
            {attachments.map((item) => (
              <li key={item.url} className="row">
                <a className="text-link" href={item.url}>{zh.ticket.attachmentAlt}</a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setAttachments((current) => current.filter((entry) => entry.url !== item.url))}
                >
                  {zh.ticket.removeAttachment}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" disabled={busy} type="submit">
        {busy ? zh.common.loading : zh.common.submit}
      </button>
    </form>
  );
}
