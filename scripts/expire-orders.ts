import { prisma } from "../src/lib/db";
import { expireDueOrders } from "../src/lib/order-expiry";

const result = await expireDueOrders();
console.log(JSON.stringify({ ok: true, ...result }));
await prisma.$disconnect();
