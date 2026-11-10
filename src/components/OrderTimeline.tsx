import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function OrderTimeline({ status }: { status: string }) {
  const zh = getDict(await getLocale());
  const steps = [
    { key: "created", label: zh.order.timeline.created },
    { key: "pending", label: status === "PAYING" ? zh.order.timeline.paying : zh.order.timeline.pending },
    { key: "paid", label: zh.order.timeline.paid },
    { key: "completed", label: zh.order.timeline.completed },
  ];

  let current = 1;
  if (status === "PAYING") current = 1;
  if (status === "PAID") current = 2;
  if (status === "COMPLETED") current = 3;
  if (status === "REFUNDED" || status === "REFUNDING") current = 2;
  if (status === "FAILED" || status === "CANCELLED") current = 1;

  return (
    <div className="card" style={{ padding: "1.15rem 1.2rem" }}>
      <ol className="v-timeline">
        {steps.map((step, index) => {
          let cls = "";
          if (status === "COMPLETED" || index < current) cls = "done";
          else if (index === current) cls = "current";
          return (
            <li key={step.key} className={cls}>
              {step.label}
            </li>
          );
        })}
      </ol>
      {(status === "REFUNDED" || status === "REFUNDING" || status === "FAILED" || status === "CANCELLED") && (
        <div className="alert alert-warn" style={{ marginTop: "0.85rem" }}>
          {(zh.order.status as Record<string, string>)[status] || status}
        </div>
      )}
    </div>
  );
}
