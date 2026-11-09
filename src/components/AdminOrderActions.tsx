"use client";

import { useRouter } from "next/navigation";
import { zh } from "@/i18n/zh";

export function AdminOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  async function setStatus(next: string) {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }
  return (
    <div className="row">
      {status !== "COMPLETED" && status !== "REFUNDED" && (
        <button className="btn btn-secondary" onClick={() => setStatus("COMPLETED")}>
          {zh.admin.markCompleted}
        </button>
      )}
      {status !== "REFUNDED" && (
        <button className="btn btn-danger" onClick={() => setStatus("REFUNDED")}>
          {zh.admin.markRefund}
        </button>
      )}
    </div>
  );
}
