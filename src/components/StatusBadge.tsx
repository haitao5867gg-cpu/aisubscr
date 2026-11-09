import { zh } from "@/i18n/zh";

const map: Record<string, string> = {
  PENDING: "badge-pending",
  PAID: "badge-paid",
  COMPLETED: "badge-completed",
  REFUNDED: "badge-refunded",
  OPEN: "badge-pending",
  REPLIED: "badge-paid",
  CLOSED: "badge-completed",
};

export function StatusBadge({
  status,
  kind = "order",
}: {
  status: string;
  kind?: "order" | "ticket";
}) {
  const label =
    kind === "order"
      ? (zh.order.status as Record<string, string>)[status] || status
      : (zh.ticket.status as Record<string, string>)[status] || status;
  return <span className={`badge ${map[status] || "badge-example"}`}>{label}</span>;
}
