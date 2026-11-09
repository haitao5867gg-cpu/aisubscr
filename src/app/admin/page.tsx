import Link from "next/link";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [products, orders, tickets, posts] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "REPLIED"] } } }),
    prisma.blogPost.count(),
  ]);
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.title}</h1>
      <p className="page-desc">管理商品、订单、工单、文章与站点设置。</p>
      <div className="card">
        {[
          ["商品", products, "/admin/products"],
          ["订单", orders, "/admin/orders"],
          ["待处理工单", tickets, "/admin/tickets"],
          ["文章", posts, "/admin/blog"],
        ].map(([label, n, href]) => (
          <Link key={String(label)} href={String(href)} className="ledger-row">
            <strong>{label}</strong>
            <span className="muted">进入管理</span>
            <span />
            <strong>{n}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
