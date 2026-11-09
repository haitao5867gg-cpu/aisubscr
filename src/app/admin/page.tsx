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
      <div className="grid-products">
        {[
          ["商品", products],
          ["订单", orders],
          ["待处理工单", tickets],
          ["文章", posts],
        ].map(([label, n]) => (
          <div key={String(label)} className="card" style={{ padding: "1.25rem" }}>
            <div className="muted">{label}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
