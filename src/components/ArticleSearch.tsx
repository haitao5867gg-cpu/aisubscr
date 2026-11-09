"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zh } from "@/i18n/zh";

export function ArticleSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/blog?q=${encodeURIComponent(q.trim())}` : "/blog");
      }}
      style={{ position: "relative" }}
    >
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>🔍</span>
      <input
        className="search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={zh.blog.searchPlaceholder}
        aria-label={zh.common.search}
      />
    </form>
  );
}
