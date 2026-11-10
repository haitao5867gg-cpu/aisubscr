"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function AdminBlogForm() {
  const zh = useDict();
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!slug.trim() || !title.trim() || !summary.trim() || !content.trim()) {
          setError(zh.common.fieldRequired);
          return;
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
          setError(zh.admin.slugInvalid);
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/admin/blog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: slug.trim(), title: title.trim(), summary: summary.trim(), content: content.trim(), published: true }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(typeof data.error === "string" && data.error ? data.error : zh.admin.actionFailed);
            return;
          }
          setSlug("");
          setTitle("");
          setSummary("");
          setContent("");
          router.refresh();
        } catch {
          setError(zh.common.requestFailed);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{zh.admin.publishPost}</h2>
      <div>
        <label className="label" htmlFor="post-slug">{zh.admin.slug}</label>
        <input id="post-slug" className="input" required value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="post-title">{zh.admin.postTitle}</label>
        <input id="post-title" className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="post-summary">{zh.admin.summary}</label>
        <input id="post-summary" className="input" required value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="post-body">{zh.admin.body}</label>
        <textarea id="post-body" className="textarea" required value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? zh.common.loading : zh.admin.publishPost}
      </button>
    </form>
  );
}
