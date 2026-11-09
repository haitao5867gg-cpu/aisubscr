import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { AccountFrame } from "@/components/AccountFrame";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login?next=/tickets");
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.userId },
    include: { order: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <AccountFrame current="tickets">
      <div>
        <h1 className="page-title">{zh.ticket.title}</h1>
        <p className="page-desc">工单挂在已支付的订单上。还没有的话，先打开对应订单再提交。</p>
      </div>
      {!tickets.length && <p className="muted">暂无工单，可在订单详情页提交售后。</p>}
      <div className="card">
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="ledger-row">
            <strong>{ticket.subject}</strong>
            <span className="muted">订单 {ticket.order.orderNo}</span>
            <span className="muted">{ticket.createdAt.toISOString().slice(0, 10)}</span>
            <StatusBadge status={ticket.status} kind="ticket" />
          </Link>
        ))}
      </div>
    </AccountFrame>
  );
}
