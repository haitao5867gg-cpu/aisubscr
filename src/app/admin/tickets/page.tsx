import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketReplyForm } from "@/components/TicketReplyForm";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const tickets = await prisma.ticket.findMany({
    include: {
      user: { select: { email: true } },
      order: true,
      replies: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.tickets}</h1>
      {tickets.map((t) => (
        <div key={t.id} className="card stack" style={{ padding: "1.1rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>
              {t.subject} · {t.user.email}
            </strong>
            <StatusBadge status={t.status} kind="ticket" />
          </div>
          <div className="muted">订单 {t.order.orderNo}</div>
          {t.replies.map((r) => (
            <div key={r.id} style={{ fontSize: "0.92rem" }}>
              <span className="badge badge-example">{r.isStaff ? "客服" : "用户"}</span> {r.body}
            </div>
          ))}
          <TicketReplyForm ticketId={t.id} admin />
        </div>
      ))}
    </div>
  );
}
