import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketReplyForm } from "@/components/TicketReplyForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const zh = getDict(await getLocale());
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
      {!tickets.length && <p className="muted">{zh.admin.empty}</p>}
      {tickets.map((t) => (
        <div key={t.id} className="card stack" style={{ padding: "1.1rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>
              {t.subject} · {t.user.email}
            </strong>
            <StatusBadge status={t.status} kind="ticket" />
          </div>
          <div className="muted">{zh.shop.orderRef} {t.order.orderNo}</div>
          {t.replies.map((r) => (
            <div key={r.id} style={{ fontSize: "0.92rem" }}>
              <span className="badge badge-example">{r.isStaff ? zh.shop.staff : zh.shop.customer}</span> {r.body}
            </div>
          ))}
          <TicketReplyForm ticketId={t.id} admin />
        </div>
      ))}
    </div>
  );
}
