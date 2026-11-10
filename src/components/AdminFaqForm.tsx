"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

type Entry = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  published: boolean;
  updatedAt: string;
};

function FaqEditor({ entry }: { entry?: Entry }) {
  const t = useDict();
  const router = useRouter();
  const [question, setQuestion] = useState(entry?.question ?? "");
  const [answer, setAnswer] = useState(entry?.answer ?? "");
  const [sortOrder, setSortOrder] = useState(entry ? String(entry.sortOrder) : "0");
  const [published, setPublished] = useState(entry?.published ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1rem" }}
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const order = Number(sortOrder);
        if (question.trim().length < 2 || answer.trim().length < 2 || !Number.isInteger(order)) {
          setError(t.admin.invalidFaq);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch(entry ? `/api/admin/faq/${entry.id}` : "/api/admin/faq", {
            method: entry ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: question.trim(), answer: answer.trim(), sortOrder: order, published }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : t.admin.invalidFaq);
            return;
          }
          if (!entry) {
            setQuestion("");
            setAnswer("");
          }
          router.refresh();
        } catch {
          setError(t.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor={entry ? `q-${entry.id}` : "q-new"}>{t.admin.faqQuestion}</label>
        <input id={entry ? `q-${entry.id}` : "q-new"} className="input" value={question} onChange={(event) => setQuestion(event.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor={entry ? `a-${entry.id}` : "a-new"}>{t.admin.faqAnswer}</label>
        <textarea id={entry ? `a-${entry.id}` : "a-new"} className="textarea" rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor={entry ? `s-${entry.id}` : "s-new"}>{t.admin.sortOrder}</label>
        <input id={entry ? `s-${entry.id}` : "s-new"} className="input" inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
      </div>
      <label className="row" style={{ margin: 0 }}>
        <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
        {t.admin.published}
      </label>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t.common.loading : entry ? t.admin.save : t.admin.newFaq}
        </button>
        {entry && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              const res = await fetch(`/api/admin/faq/${entry.id}`, { method: "DELETE" });
              if (!res.ok) {
                setError(t.admin.actionFailed);
                return;
              }
              router.refresh();
            }}
          >
            {t.admin.remove}
          </button>
        )}
      </div>
    </form>
  );
}

export function AdminFaqForm({ entries }: { entries: Entry[] }) {
  const t = useDict();
  return (
    <div className="stack">
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{t.admin.newFaq}</h2>
      <FaqEditor />
      {entries.map((entry) => (
        <FaqEditor key={`${entry.id}-${entry.updatedAt}`} entry={entry} />
      ))}
    </div>
  );
}
