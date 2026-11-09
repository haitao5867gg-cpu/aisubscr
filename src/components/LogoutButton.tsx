"use client";

import { useRouter } from "next/navigation";
import { zh } from "@/i18n/zh";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-secondary"
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
