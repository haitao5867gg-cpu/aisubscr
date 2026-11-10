import { ensureSqlitePragmas, prisma } from "../src/lib/db";
import { expireDueOrders } from "../src/lib/order-expiry";

// tsx compiles this file as CommonJS when package.json has no "type": "module".
// Top-level await is rejected there, so the sweep stays inside main().
async function main() {
  await ensureSqlitePragmas();
  const result = await expireDueOrders();
  console.log(JSON.stringify({ ok: true, ...result }));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
