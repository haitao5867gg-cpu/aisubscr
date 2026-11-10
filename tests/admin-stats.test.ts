import { expect, it } from "vitest";
import { zh } from "@/i18n";
import {
  conversionFunnel,
  crossedLowStock,
  lowStockList,
  rankTopProducts,
  stepRate,
  summarizeShop,
} from "@/lib/admin-stats";
import { adminLowStockNotice, adminPaidOrderNotice } from "@/lib/mail/notices";

it("counts a Shanghai day and leaves refunded orders out of revenue", () => {
  const now = new Date("2026-11-10T02:00:00.000Z");
  const summary = summarizeShop({
    now,
    orders: [
      {
        createdAt: new Date("2026-11-09T16:30:00.000Z"),
        paidAt: new Date("2026-11-09T16:40:00.000Z"),
        status: "PAID",
        totalCents: 1000,
      },
      {
        createdAt: new Date("2026-11-09T15:00:00.000Z"),
        paidAt: new Date("2026-11-09T15:10:00.000Z"),
        status: "REFUNDED",
        totalCents: 5000,
      },
    ],
    users: [{ createdAt: new Date("2026-11-09T17:00:00.000Z") }],
  });

  expect(summary.ranges.find((range) => range.key === "today")).toMatchObject({
    orders: 1,
    paidOrders: 1,
    revenueCents: 1000,
    users: 1,
  });
  expect(summary.ranges.find((range) => range.key === "d7")).toMatchObject({
    orders: 2,
    paidOrders: 1,
    revenueCents: 1000,
  });
  expect(summary.chart).toHaveLength(7);
  expect(summary.chart.at(-1)).toMatchObject({ day: "2026-11-10", orders: 1, paidOrders: 1, revenueCents: 1000 });
  expect(summary.chart.at(-2)).toMatchObject({ day: "2026-11-09", orders: 1, paidOrders: 0, revenueCents: 0 });
});

it("counts a payment on the paid day when the order was placed earlier", () => {
  const now = new Date("2026-11-10T02:00:00.000Z");
  const summary = summarizeShop({
    now,
    orders: [
      {
        createdAt: new Date("2026-11-01T02:00:00.000Z"),
        paidAt: new Date("2026-11-09T16:05:00.000Z"),
        status: "COMPLETED",
        totalCents: 2500,
      },
    ],
    users: [],
  });
  expect(summary.ranges.find((range) => range.key === "today")).toMatchObject({
    orders: 0,
    paidOrders: 1,
    revenueCents: 2500,
  });
});

it("ranks paid products by revenue and keeps the top of the list", () => {
  const ranked = rankTopProducts(
    [
      { productId: "a", productName: "甲", unitPriceCents: 100, quantity: 2 },
      { productId: "b", productName: "乙", unitPriceCents: 500, quantity: 1 },
      { productId: "a", productName: "甲", unitPriceCents: 100, quantity: 1 },
    ],
    1,
  );
  expect(ranked).toEqual([{ productId: "b", name: "乙", quantity: 1, revenueCents: 500 }]);
});

it("counts a page view, checkout, and paid visitor once each", () => {
  const funnel = conversionFunnel({
    pageVisitors: ["v1", "v1", "v2"],
    checkoutVisitors: ["v1", "v1"],
    paidVisitors: ["v1", "v3"],
  });
  expect(funnel).toEqual({ page: 2, checkout: 1, paid: 2 });
  expect(stepRate(funnel.checkout, funnel.page)).toBe(50);
  expect(stepRate(1, 0)).toBeNull();
});

it("lists only tracked stock at or below the product threshold", () => {
  const rows = lowStockList([
    { id: "high", name: "充足", stock: 9, lowStockThreshold: 5, active: true },
    { id: "open", name: "不限", stock: null, lowStockThreshold: 5, active: true },
    { id: "low", name: "乙", stock: 2, lowStockThreshold: 5, active: true },
    { id: "out", name: "甲", stock: 0, lowStockThreshold: 5, active: false },
    { id: "edge", name: "丙", stock: 5, lowStockThreshold: 5, active: true },
  ]);
  expect(rows.map((row) => row.id)).toEqual(["out", "low", "edge"]);
});

it("notices only the order that crosses the threshold", () => {
  expect(crossedLowStock({ stock: 4, quantity: 2, threshold: 5 })).toBe(true);
  expect(crossedLowStock({ stock: 5, quantity: 1, threshold: 5 })).toBe(true);
  expect(crossedLowStock({ stock: 3, quantity: 1, threshold: 5 })).toBe(false);
  expect(crossedLowStock({ stock: 9, quantity: 1, threshold: 5 })).toBe(false);
  expect(crossedLowStock({ stock: null, quantity: 2, threshold: 5 })).toBe(false);
});

it("adds low-stock lines to the paid-order admin email", () => {
  const notice = adminPaidOrderNotice(
    { orderNo: "AS1", amount: "¥10.00", email: "a@example.com" },
    zh,
    [{ name: "示例商品 A", stock: 2, threshold: 5 }],
  );
  expect(notice.text).toContain("AS1");
  expect(notice.text).toContain("示例商品 A");
  expect(notice.text).toContain("剩余 2");
  expect(notice.html).toContain("示例商品 A");

  const plain = adminPaidOrderNotice({ orderNo: "AS1", amount: "¥10.00", email: "a@example.com" }, zh);
  expect(plain.text).not.toContain("阈值");

  const only = adminLowStockNotice({ orderNo: "AS9", items: [{ name: "示例商品 A", stock: 1, threshold: 5 }] }, zh);
  expect(only.subject).toContain("低库存");
  expect(only.text).toContain("AS9");
  expect(only.text).toContain("示例商品 A");
});
