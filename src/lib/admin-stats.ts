const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Revenue stays on paid, completed, and in-progress refunds. A finished refund does not. */
export const REVENUE_STATUSES = ["PAID", "COMPLETED", "REFUNDING"] as const;
const REVENUE_STATUS_SET = new Set<string>(REVENUE_STATUSES);

export const TOP_PRODUCT_LIMIT = 5;

export type SummaryOrder = {
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  totalCents: number;
};

export type SummaryUser = { createdAt: Date };

export type ShopSummary = {
  ranges: { key: "today" | "d7" | "d30"; orders: number; paidOrders: number; revenueCents: number; users: number }[];
  chart: { day: string; label: string; orders: number; paidOrders: number; revenueCents: number }[];
};

export type SoldLine = {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
};

export type RankedProduct = {
  productId: string;
  name: string;
  quantity: number;
  revenueCents: number;
};

export type StockRow = {
  id: string;
  name: string;
  stock: number | null;
  lowStockThreshold: number;
  active: boolean;
};

export type FunnelCounts = {
  page: number;
  checkout: number;
  paid: number;
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

function isRevenueOrder(order: SummaryOrder) {
  return Boolean(order.paidAt) && REVENUE_STATUS_SET.has(order.status);
}

function inWindow(when: Date, start: Date, end?: Date) {
  return when >= start && (!end || when < end);
}

function sumRevenue(orders: SummaryOrder[], start: Date, end?: Date) {
  return orders.reduce((sum, order) => {
    if (!isRevenueOrder(order) || !order.paidAt || !inWindow(order.paidAt, start, end)) return sum;
    return sum + order.totalCents;
  }, 0);
}

function countPaid(orders: SummaryOrder[], start: Date, end?: Date) {
  return orders.reduce((count, order) => {
    if (!isRevenueOrder(order) || !order.paidAt || !inWindow(order.paidAt, start, end)) return count;
    return count + 1;
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
    paidOrders: countPaid(input.orders, window.start),
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
      paidOrders: countPaid(input.orders, start, end),
      revenueCents: sumRevenue(input.orders, start, end),
    });
  }
  return { ranges, chart };
}

/** Paid lines in the window, highest revenue first. */
export function rankTopProducts(lines: SoldLine[], limit = TOP_PRODUCT_LIMIT): RankedProduct[] {
  const map = new Map<string, RankedProduct>();
  for (const line of lines) {
    const quantity = line.quantity > 0 ? line.quantity : 0;
    const current = map.get(line.productId) ?? {
      productId: line.productId,
      name: line.productName,
      quantity: 0,
      revenueCents: 0,
    };
    current.quantity += quantity;
    current.revenueCents += line.unitPriceCents * quantity;
    current.name = line.productName;
    map.set(line.productId, current);
  }
  return [...map.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity || a.name.localeCompare(b.name, "zh"))
    .slice(0, Math.max(0, limit));
}

/** Distinct visitors at page view, checkout, and paid. */
export function conversionFunnel(input: {
  pageVisitors: readonly string[];
  checkoutVisitors: readonly string[];
  paidVisitors: readonly string[];
}): FunnelCounts {
  return {
    page: new Set(input.pageVisitors).size,
    checkout: new Set(input.checkoutVisitors).size,
    paid: new Set(input.paidVisitors).size,
  };
}

/** Percent of the previous step, or null when that step had nobody. */
export function stepRate(count: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round((count / previous) * 100);
}

/** Tracked stock at or below the product's own threshold. */
export function isLowStock(product: { stock: number | null; lowStockThreshold: number }) {
  return product.stock !== null && product.stock <= product.lowStockThreshold;
}

export function lowStockList(products: StockRow[]) {
  return products
    .filter((product) => isLowStock(product))
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0) || a.name.localeCompare(b.name, "zh"));
}

/**
 * True when this order's reserved quantity moved tracked stock from above the
 * threshold to at or below it. Stock is reserved at checkout, so `stock` is
 * the count after the reservation and `quantity` is this order's units.
 */
export function crossedLowStock(input: { stock: number | null; quantity: number; threshold: number }) {
  if (input.stock === null || input.quantity <= 0) return false;
  const before = input.stock + input.quantity;
  return before > input.threshold && input.stock <= input.threshold;
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
