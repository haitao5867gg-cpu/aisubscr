export const ORDER_STATUSES = [
  "PENDING",
  "PAYING",
  "PAID",
  "COMPLETED",
  "REFUNDING",
  "REFUNDED",
  "CANCELLED",
  "FAILED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAYING", "PAID", "CANCELLED", "FAILED"],
  PAYING: ["PAID", "FAILED", "CANCELLED", "PENDING"],
  PAID: ["COMPLETED", "REFUNDING", "REFUNDED"],
  COMPLETED: ["REFUNDING", "REFUNDED"],
  REFUNDING: ["REFUNDED", "COMPLETED"],
  REFUNDED: [],
  CANCELLED: [],
  FAILED: ["PENDING", "PAYING"],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Customer and gateway transitions. Same-state is a no-op success. */
export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
  return transitions[from].includes(to);
}

/**
 * Manual admin actions. Completing a still-unpaid demo order stays allowed,
 * matching the existing "标记完成" control.
 */
export function canAdminSet(from: string, to: string): boolean {
  if (to === "COMPLETED") return ["PENDING", "PAYING", "PAID", "COMPLETED"].includes(from);
  if (to === "REFUNDED") return ["PAID", "COMPLETED", "REFUNDING", "REFUNDED"].includes(from);
  return canTransition(from, to);
}
