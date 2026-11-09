/** Display-only renewal estimate. Does not bill or schedule anything. */
export function renewalDate(order: {
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  items: { isSubscription: boolean }[];
}): Date | null {
  if (order.status !== "PAID" && order.status !== "COMPLETED") return null;
  if (!order.items.some((item) => item.isSubscription)) return null;
  const base = new Date(order.paidAt ?? order.createdAt);
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + 30);
  return next;
}

export function formatDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
