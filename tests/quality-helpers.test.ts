import { expect, it } from "vitest";
import { lineQuantity, MAX_LINE_QUANTITY } from "@/lib/catalog";
import { paymentMethodLabel } from "@/lib/payment-label";
import { reviveTimestamp } from "@/lib/public-content";

const labels = { wechat: "微信支付", alipay: "支付宝", mock: "模拟支付" };

it("accepts cart quantities from 1 through 99", () => {
  expect(lineQuantity(1)).toBe(1);
  expect(lineQuantity(MAX_LINE_QUANTITY)).toBe(99);
  expect(lineQuantity(0)).toBeNull();
  expect(lineQuantity(100)).toBeNull();
  expect(lineQuantity(1.5)).toBeNull();
  expect(lineQuantity("2")).toBeNull();
});

it("names stored payment methods and keeps unknown ones visible", () => {
  expect(paymentMethodLabel("WECHAT", labels)).toBe("微信支付");
  expect(paymentMethodLabel("ALIPAY", labels)).toBe("支付宝");
  expect(paymentMethodLabel("MOCK", labels)).toBe("模拟支付");
  expect(paymentMethodLabel(null, labels)).toBe("—");
  expect(paymentMethodLabel("CARD", labels)).toBe("CARD");
});

it("turns cached timestamps back into dates", () => {
  const source = new Date("2026-01-02T03:04:05.000Z");
  expect(reviveTimestamp(source)).toBe(source);
  expect(reviveTimestamp(source.toISOString()).toISOString()).toBe(source.toISOString());
});
