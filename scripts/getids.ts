
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const product = await p.product.findFirst();
  const order = await p.order.findFirst({ orderBy: { createdAt: "desc" } });
  console.log(JSON.stringify({ productId: product?.id, token: order?.publicToken, orderId: order?.id }));
}
main().finally(() => p.$disconnect());
