import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login");
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.userId },
    include: { order: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.ticket.title}</h1>
      {!tickets.length && <p className="muted">暂无工单，可在订单详情页提交售后。</p>}
      {tickets.map((t) => (
        <Link key={t.id} href={`/tickets/${t.id}`} className="card" style={{ padding: "1rem", display: "block" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{t.subject}</strong>
            <StatusBadge status={t.status} kind="ticket" />
          </div>
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            订单 {t.order.orderNo}
          </div>
        </Link>
      ))}
    </div>
  );
}
