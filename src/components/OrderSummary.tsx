import { formatRmb } from "@/lib/money";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { StatusBadge } from "./StatusBadge";

export async function OrderSummary({
  orderNo,
  status,
  totalCents,
  subtotalCents,
  discountCents = 0,
  couponCode,
  paymentMethod,
  paymentProvider,
  isRenewal,
  renewalDay,
  items,
}: {
  orderNo: string;
  status: string;
  totalCents: number;
  subtotalCents?: number;
  discountCents?: number;
  couponCode?: string | null;
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
  const zh = getDict(await getLocale());
  return (
    <aside className="card summary-card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{zh.shop.summary}</strong>
        <StatusBadge status={status} />
      </div>
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        {orderNo}
        {isRenewal ? ` · ${zh.shop.renewalTag}` : ""}
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
      {discountCents > 0 && (
        <>
          <div className="money-row">
            <span className="muted">{zh.order.subtotal}</span>
            <span>{formatRmb(subtotalCents ?? totalCents + discountCents)}</span>
          </div>
          <div className="money-row">
            <span className="muted">
              {zh.order.discount}
              {couponCode ? ` · ${couponCode}` : ""}
            </span>
            <strong>-{formatRmb(discountCents)}</strong>
          </div>
        </>
      )}
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
