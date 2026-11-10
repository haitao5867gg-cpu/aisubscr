import type { Prisma } from "@prisma/client";
import { isOrderStatus } from "./payments/states";

export type OrderListFilters = {
  q?: string;
  status?: string;
  email?: string;
  from?: string;
  to?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function first(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export function readOrderFilters(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): OrderListFilters {
  const pick = (name: string) => {
    if (typeof (source as URLSearchParams).get === "function") {
      return (source as URLSearchParams).get(name)?.trim() ?? "";
    }
    return first((source as Record<string, string | string[] | undefined>)[name]);
  };
  const status = pick("status");
  return {
    q: pick("q") || undefined,
    status: status && isOrderStatus(status) ? status : undefined,
    email: pick("email").toLowerCase() || undefined,
    from: pick("from") || undefined,
    to: pick("to") || undefined,
  };
}

/** Inclusive calendar day in Asia/Shanghai, returned as a UTC instant. */
function shanghaiDayStart(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function adminOrderWhere(filters: OrderListFilters): Prisma.OrderWhereInput {
  const from = shanghaiDayStart(filters.from);
  const toStart = shanghaiDayStart(filters.to);
  const to = toStart ? new Date(toStart.getTime() + DAY_MS) : undefined;
  const q = filters.q?.trim();
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.email ? { user: { email: { contains: filters.email } } } : {}),
    ...(q
      ? {
          OR: [{ orderNo: { contains: q } }, { user: { email: { contains: q.toLowerCase() } } }],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: to } : {}),
          },
        }
      : {}),
  };
}

export function orderFilterQuery(filters: OrderListFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.email) params.set("email", filters.email);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

type CsvOrder = {
  orderNo: string;
  status: string;
  totalCents: number;
  paymentMethod: string | null;
  createdAt: Date;
  paidAt: Date | null;
  user: { email: string };
  items: { productName: string; quantity: number }[];
};

function csvCell(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function ordersToCsv(orders: CsvOrder[]) {
  const header = ["订单号", "邮箱", "状态", "金额（分）", "支付方式", "下单时间", "支付时间", "商品"];
  const lines = [header.map(csvCell).join(",")];
  for (const order of orders) {
    lines.push(
      [
        order.orderNo,
        order.user.email,
        order.status,
        order.totalCents,
        order.paymentMethod ?? "",
        order.createdAt.toISOString(),
        order.paidAt ? order.paidAt.toISOString() : "",
        order.items.map((item) => `${item.productName} x${item.quantity}`).join(" | "),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
