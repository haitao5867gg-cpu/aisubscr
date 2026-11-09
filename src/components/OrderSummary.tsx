import { formatRmb } from "@/lib/money";
import { zh } from "@/i18n/zh";
import { StatusBadge } from "./StatusBadge";

export function OrderSummary({
  orderNo,
  status,
  totalCents,
  paymentMethod,
  paymentProvider,
  isRenewal,
  renewalDay,
  items,
}: {
  orderNo: string;
  status: string;
  totalCents: number;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  isRenewal?: boolean;
  renewalDay?: string | null;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    isSubscription: boolean;
  }[];
}) {
  return (
    <aside className="card summary-card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{zh.shop.summary}</strong>
        <StatusBadge status={status} />
      </div>
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        {orderNo}
        {isRenewal ? " · 续费单" : ""}
      </div>
      {items.map((item) => (
        <div key={item.id} className="money-row">
          <span>
            {item.productName} × {item.quantity}
            {item.isSubscription ? ` · ${zh.shop.renewIncluded}` : ""}
          </span>
          <strong>{formatRmb(item.unitPriceCents * item.quantity)}</strong>
        </div>
      ))}
      <div className="money-row" style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
        <span className="muted">{zh.shop.payable}</span>
        <strong className="plan-price" style={{ fontSize: "1.45rem" }}>
          {formatRmb(totalCents)}
        </strong>
      </div>
      <div className="money-row">
        <span className="muted">{zh.shop.payMethod}</span>
        <span>
          {paymentMethod || "—"}
          {paymentProvider === "MOCK" && (
            <>
              {" "}
              <span className="badge badge-mock">{zh.common.mockPay}</span>
            </>
          )}
        </span>
      </div>
      {renewalDay && (
        <div className="money-row">
          <span className="muted">{zh.shop.nextRenewal}</span>
          <span>{renewalDay}</span>
        </div>
      )}
    </aside>
  );
}
