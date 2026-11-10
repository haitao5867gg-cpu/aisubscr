const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Revenue stays on paid, completed, and in-progress refunds. A finished refund does not. */
const REVENUE_STATUSES = new Set(["PAID", "COMPLETED", "REFUNDING"]);

export type SummaryOrder = {
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  totalCents: number;
};

export type SummaryUser = { createdAt: Date };

export type ShopSummary = {
  ranges: { key: "today" | "d7" | "d30"; orders: number; revenueCents: number; users: number }[];
  chart: { day: string; label: string; orders: number; revenueCents: number }[];
};

/** Calendar day in Asia/Shanghai. China has no daylight-saving time. */
export function shanghaiDay(date: Date) {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function shanghaiStart(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date) - OFFSET_MS);
}

function addDays(day: string, delta: number) {
  return shanghaiDay(new Date(shanghaiStart(day).getTime() + delta * DAY_MS));
}

function countOrders(orders: SummaryOrder[], start: Date, end?: Date) {
  return orders.filter((order) => order.createdAt >= start && (!end || order.createdAt < end)).length;
}

function sumRevenue(orders: SummaryOrder[], start: Date, end?: Date) {
  return orders.reduce((sum, order) => {
    if (!order.paidAt || !REVENUE_STATUSES.has(order.status)) return sum;
    if (order.paidAt < start || (end && order.paidAt >= end)) return sum;
    return sum + order.totalCents;
  }, 0);
}

export function summarizeShop(input: {
  now?: Date;
  orders: SummaryOrder[];
  users: SummaryUser[];
}): ShopSummary {
  const today = shanghaiDay(input.now ?? new Date());
  const windows = [
    { key: "today" as const, start: shanghaiStart(today) },
    { key: "d7" as const, start: shanghaiStart(addDays(today, -6)) },
    { key: "d30" as const, start: shanghaiStart(addDays(today, -29)) },
  ];
  const ranges = windows.map((window) => ({
    key: window.key,
    orders: countOrders(input.orders, window.start),
    revenueCents: sumRevenue(input.orders, window.start),
    users: input.users.filter((user) => user.createdAt >= window.start).length,
  }));
  const chart = [];
  for (let ago = 6; ago >= 0; ago -= 1) {
    const day = addDays(today, -ago);
    const start = shanghaiStart(day);
    const end = new Date(start.getTime() + DAY_MS);
    chart.push({
      day,
      label: day.slice(5),
      orders: countOrders(input.orders, start, end),
      revenueCents: sumRevenue(input.orders, start, end),
    });
  }
  return { ranges, chart };
}

export function formatShanghai(date: Date, locale: "zh" | "en" = "zh") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-CA" : "zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function shanghaiWindowStart(days: number, now = new Date()) {
  const today = shanghaiDay(now);
  return shanghaiStart(addDays(today, -(days - 1)));
}
