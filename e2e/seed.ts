import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      siteName: "aisubscr",
      supportEmail: "support@example.com",
      supportHours: "08:00–23:00",
      footerText: "示例数字商品商城框架 · 仅供演示",
    },
  });

  const adminEmail = "e2e-admin@example.com";
  const passwordHash = await bcrypt.hash("e2e-admin-pass", 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "ADMIN", disabled: false, name: "端到端管理员" },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      name: "端到端管理员",
    },
  });

  const existing = await prisma.product.findFirst({ where: { name: "示例商品 A" } });
  if (!existing) {
    await prisma.product.create({
      data: {
        name: "示例商品 A",
        description: "端到端冒烟用的示例商品。不含任何账号交付。",
        priceCents: 9900,
        isSubscription: false,
        active: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
