import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@aisubscr.local";
  const adminPassword = `Adm${Math.random().toString(36).slice(2, 10)}!${Date.now().toString(36).slice(-4)}`;
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "ADMIN", name: "管理员" },
    create: {
      email: adminEmail,
      passwordHash,
      name: "管理员",
      role: "ADMIN",
    },
  });

  writeFileSync(
    join(process.cwd(), "ADMIN_CREDENTIALS.txt"),
    [
      "# aisubscr 管理后台账号（请勿提交到 Git）",
      `email=${adminEmail}`,
      `password=${adminPassword}`,
      `userId=${admin.id}`,
      `createdAt=${new Date().toISOString()}`,
      "",
    ].join("\n"),
    { mode: 0o600 }
  );

  await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      siteName: "aisubscr",
      supportEmail: "support@example.com",
      supportHours: "08:00–23:00",
      footerText: "示例数字商品商城框架 · 仅供演示 · 非真实交易",
    },
  });

  const products = [
    {
      name: "示例商品 A",
      description:
        "这是占位示例商品 A，用于演示商品列表、详情与下单流程。内容为虚构数据，不含任何第三方账号或订阅。",
      priceCents: 9900,
      isSubscription: false,
    },
    {
      name: "示例商品 B（可续费）",
      description:
        "这是占位示例商品 B，标记为可按月续费。演示订单续费按钮会生成新的待支付订单。内容为虚构数据。",
      priceCents: 19900,
      isSubscription: true,
    },
    {
      name: "示例商品 C",
      description: "这是占位示例商品 C，用于展示多商品购物车结算。纯示例数据。",
      priceCents: 4900,
      isSubscription: false,
    },
  ];

  const existing = await prisma.product.count();
  if (existing === 0) {
    await prisma.product.createMany({ data: products });
  }

  const posts = [
    {
      slug: "welcome",
      title: "欢迎使用 aisubscr 通用商城框架",
      summary: "本文介绍本项目的定位：通用数字商品电商框架，支持注册、下单、模拟支付与售后。",
      content: `本项目是一个**通用数字商品电商框架**，用于本地预览商城流程。

## 已实现能力

- 用户注册 / 登录
- 商品列表与详情
- 购物车与下单
- 可插拔支付接口（当前为模拟支付）
- 订单状态与分享链接
- 售后工单
- 管理后台与站点设置
- 简单文章 / 博客

## 说明

商品与文章均为**示例数据**。支付为 **MOCK 模拟支付**，不会产生真实扣款。`,
      authorName: "管理员",
    },
    {
      slug: "how-to-order",
      title: "如何完成一笔示例订单",
      summary: "从注册到模拟支付、查看订单与提交售后的完整演示路径。",
      content: `1. 注册并登录账号  
2. 在「商品」中选择示例商品加入购物车  
3. 结算后选择微信支付 / 支付宝（均走模拟支付）  
4. 在「我的订单」查看状态，或通过订单分享链接访问  
5. 如需演示售后，可在订单页创建工单  

正式接入真实支付时，需配置商户凭证并替换 MOCK 提供商。`,
      authorName: "管理员",
    },
  ];

  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: { title: post.title, summary: post.summary, content: post.content },
      create: post,
    });
  }

  const faqCount = await prisma.faqEntry.count();
  if (faqCount === 0) {
    await prisma.faqEntry.create({
      data: {
        question: "支付会真实扣款吗？",
        answer: "不会。当前没有商户凭证，微信和支付宝都走到模拟支付。",
        sortOrder: 0,
        published: true,
      },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      kind: "PERCENT",
      percentOff: 10,
      minOrderCents: 0,
      active: true,
    },
  });

  console.log("Seed complete. Admin credentials written to ADMIN_CREDENTIALS.txt");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
