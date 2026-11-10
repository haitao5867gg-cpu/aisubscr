"use client";

import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const zh = useDict();
  const router = useRouter();
  return (
    <button
      type="button"
      className={compact ? "btn btn-ghost" : "btn btn-secondary"}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      {zh.nav.logout}
    </button>
  );
}
