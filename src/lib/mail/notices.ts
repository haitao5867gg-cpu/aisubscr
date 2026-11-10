import { randomUUID } from "crypto";
import { formatRmb } from "../money";
import { logApiError } from "../server-log";
import { getMailer } from "./index";
import { mailDocument, paragraph } from "./template";
import type { OutboundMail } from "./types";

type Notice = Omit<OutboundMail, "to">;

export function orderPaidNotice(input: {
  orderNo: string;
  totalCents: number;
  items: { productName: string; quantity: number }[];
}): Notice {
  const amount = formatRmb(input.totalCents);
  const items = input.items.map((item) => `${item.productName} × ${item.quantity}`).join("、");
  const text = [
    `订单 ${input.orderNo} 已支付。`,
    `金额：${amount}`,
    `商品：${items}`,
    "可在个人中心查看订单。这封邮件只确认付款，不包含任何账号或卡密。",
  ].join("\n");
  return {
    subject: "aisubscr 订单已支付",
    text,
    html: mailDocument(
      "订单已支付",
      [
        paragraph(`订单 ${input.orderNo} 已支付。`),
        paragraph(`金额：${amount}`),
        paragraph(`商品：${items}`),
        paragraph("可在个人中心查看订单。这封邮件只确认付款，不包含任何账号或卡密。"),
      ].join(""),
    ),
  };
}

export function passwordChangedNotice(): Notice {
  const text = ["你的 aisubscr 密码刚刚被修改。", "如果不是你本人操作，请马上重置密码并联系客服。"].join("\n");
  return {
    subject: "aisubscr 密码已修改",
    text,
    html: mailDocument("密码已修改", [paragraph("你的 aisubscr 密码刚刚被修改。"), paragraph("如果不是你本人操作，请马上重置密码并联系客服。")].join("")),
  };
}

export function emailChangedNotice(input: { oldEmail: string; newEmail: string }): Notice {
  const text = [
    `你的 aisubscr 登录邮箱已从 ${input.oldEmail} 改为 ${input.newEmail}。`,
    "如果不是你本人操作，请马上联系客服。",
  ].join("\n");
  return {
    subject: "aisubscr 登录邮箱已更改",
    text,
    html: mailDocument(
      "登录邮箱已更改",
      [
        paragraph(`你的 aisubscr 登录邮箱已从 ${input.oldEmail} 改为 ${input.newEmail}。`),
        paragraph("如果不是你本人操作，请马上联系客服。"),
      ].join(""),
    ),
  };
}

export function emailChangeCodeNotice(code: string): Notice {
  const text = [`您的验证码是 ${code}`, "验证码 15 分钟内有效。如非本人操作，请忽略这封邮件。"].join("\n");
  return {
    subject: "aisubscr 更换邮箱验证码",
    text,
    html: mailDocument(
      "更换邮箱验证码",
      [paragraph(`您的验证码是 ${code}`), paragraph("验证码 15 分钟内有效。如非本人操作，请忽略这封邮件。")].join(""),
    ),
  };
}

/** Notices must not fail the action that triggered them. */
export async function deliverQuietly(mail: OutboundMail, route: string) {
  try {
    const mailer = getMailer();
    await mailer.send(mail);
    if (mailer.name === "smtp") {
      console.info(`[aisubscr mail] sent route=${route} to=${mail.to}`);
    }
  } catch (error) {
    logApiError({
      requestId: randomUUID(),
      route,
      status: 500,
      error,
    });
  }
}

export async function deliverPasswordChanged(to: string) {
  await deliverQuietly({ to, ...passwordChangedNotice() }, "mail:password-changed");
}

export async function deliverEmailChanged(oldEmail: string, newEmail: string) {
  await deliverQuietly(
    { to: oldEmail, ...emailChangedNotice({ oldEmail, newEmail }) },
    "mail:email-changed",
  );
}

export async function deliverOrderPaid(input: {
  to: string;
  orderNo: string;
  totalCents: number;
  items: { productName: string; quantity: number }[];
}) {
  await deliverQuietly(
    {
      to: input.to,
      ...orderPaidNotice(input),
    },
    "mail:order-paid",
  );
}
