import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketReplyForm } from "@/components/TicketReplyForm";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login");
  const ticket = await prisma.ticket.findFirst({
    where: { id, userId: session.userId },
    include: {
      order: true,
      replies: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {ticket.subject}
        </h1>
        <StatusBadge status={ticket.status} kind="ticket" />
      </div>
      <div className="muted">订单 {ticket.order.orderNo}</div>
      <div className="stack">
        {ticket.replies.map((r) => (
          <div key={r.id} className="card" style={{ padding: "1rem" }}>
            <div className="row" style={{ marginBottom: "0.35rem" }}>
              <span className="badge badge-example">{r.isStaff ? "客服" : "我"}</span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {r.createdAt.toISOString()}
              </span>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{r.body}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: "1.1rem" }}>
        <TicketReplyForm ticketId={ticket.id} />
      </div>
    </div>
  );
}
