"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DismissAnnouncement({ storageKey, label }: { storageKey: string; label: string }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        document.cookie = `aisubscr-announce=${encodeURIComponent(storageKey)}; Path=/; Max-Age=31536000; SameSite=Lax`;
        setHidden(true);
        const banner = document.querySelector(".announce");
        if (banner) banner.remove();
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
