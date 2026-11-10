import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

const map: Record<string, string> = {
  PENDING: "badge-pending",
  PAYING: "badge-paying",
  PAID: "badge-paid",
  COMPLETED: "badge-completed",
  REFUNDING: "badge-pending",
  REFUNDED: "badge-refunded",
  CANCELLED: "badge-example",
  EXPIRED: "badge-example",
  FAILED: "badge-refunded",
  OPEN: "badge-pending",
  WAITING_CUSTOMER: "badge-paying",
  RESOLVED: "badge-completed",
  REPLIED: "badge-paid",
  CLOSED: "badge-example",
};

export async function StatusBadge({
  status,
  kind = "order",
}: {
  status: string;
  kind?: "order" | "ticket";
}) {
  const zh = getDict(await getLocale());
  const label =
    kind === "order"
      ? (zh.order.status as Record<string, string>)[status] || status
      : (zh.ticket.status as Record<string, string>)[status] || status;
  return <span className={`badge ${map[status] || "badge-example"}`}>{label}</span>;
}
