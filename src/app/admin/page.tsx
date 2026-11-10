import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const zh = getDict(await getLocale());
  const [products, orders, tickets, posts] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "REPLIED"] } } }),
    prisma.blogPost.count(),
  ]);
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.title}</h1>
      <p className="page-desc">{zh.admin.lead}</p>
      <div className="card">
        {[
          [zh.admin.productsCount, products, "/admin/products"],
          [zh.admin.ordersCount, orders, "/admin/orders"],
          [zh.admin.openTickets, tickets, "/admin/tickets"],
          [zh.admin.postsCount, posts, "/admin/blog"],
        ].map(([label, n, href]) => (
          <Link key={String(label)} href={String(href)} className="ledger-row">
            <strong>{label}</strong>
            <span className="muted">{zh.admin.dashboardLead}</span>
            <span />
            <strong>{n}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
