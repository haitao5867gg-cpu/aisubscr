"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminBlogForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");

  return (
    <form
      className="card stack"
      style={{ padding: "1.25rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch("/api/admin/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, title, summary, content, published: true }),
        });
        setSlug("");
        setTitle("");
        setSummary("");
        setContent("");
        router.refresh();
      }}
    >
      <h3 style={{ margin: 0 }}>发布文章</h3>
      <input className="input" placeholder="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} />
      <input className="input" placeholder="标题" required value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="input" placeholder="摘要" required value={summary} onChange={(e) => setSummary(e.target.value)} />
      <textarea className="textarea" placeholder="正文" required value={content} onChange={(e) => setContent(e.target.value)} />
      <button className="btn btn-primary" type="submit">
        发布
      </button>
    </form>
  );
}
