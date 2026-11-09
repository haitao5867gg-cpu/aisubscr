import { zh } from "@/i18n/zh";

export function OrderTimeline({ status }: { status: string }) {
  const steps = [
    { key: "created", label: zh.order.timeline.created },
    { key: "pending", label: zh.order.timeline.pending },
    { key: "paid", label: zh.order.timeline.paid },
    { key: "completed", label: zh.order.timeline.completed },
  ];

  let current = 1;
  if (status === "PAID") current = 2;
  if (status === "COMPLETED") current = 3;
  if (status === "REFUNDED") current = 2;

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
      {status === "REFUNDED" && (
        <div className="alert alert-warn" style={{ marginTop: "0.85rem" }}>
          当前状态：{zh.order.status.REFUNDED}
        </div>
      )}
    </div>
  );
}
