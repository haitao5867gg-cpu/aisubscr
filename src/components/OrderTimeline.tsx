import { zh } from "@/i18n/zh";

export function OrderTimeline({ status }: { status: string }) {
  const steps = [
    { key: "created", label: zh.order.timeline.created },
    { key: "pending", label: zh.order.timeline.pending },
    { key: "paid", label: zh.order.timeline.paid },
    { key: "completed", label: zh.order.timeline.completed },
  ];

  // index of current step
  let current = 1; // PENDING
  if (status === "PAID") current = 2;
  if (status === "COMPLETED") current = 3;
  if (status === "REFUNDED") current = 2;

  return (
    <div className="card" style={{ padding: "1.1rem 1rem" }}>
      <div className="timeline">
        {steps.map((s, i) => {
          let cls = "";
          if (status === "COMPLETED") cls = "done";
          else if (i < current) cls = "done";
          else if (i === current) cls = "current";
          return (
            <div key={s.key} className={`timeline-step ${cls}`}>
              {s.label}
            </div>
          );
        })}
      </div>
      {status === "REFUNDED" && (
        <div
          className="alert"
          style={{
            marginTop: "0.75rem",
            background: "var(--danger-soft)",
            color: "var(--danger)",
            borderColor: "transparent",
          }}
        >
          当前状态：{zh.order.status.REFUNDED}
        </div>
      )}
    </div>
  );
}
