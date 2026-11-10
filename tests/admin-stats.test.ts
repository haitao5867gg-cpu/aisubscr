import { expect, it } from "vitest";
import { summarizeShop } from "@/lib/admin-stats";

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
    revenueCents: 1000,
    users: 1,
  });
  expect(summary.ranges.find((range) => range.key === "d7")).toMatchObject({
    orders: 2,
    revenueCents: 1000,
  });
  expect(summary.chart).toHaveLength(7);
  expect(summary.chart.at(-1)).toMatchObject({ day: "2026-11-10", orders: 1, revenueCents: 1000 });
});
