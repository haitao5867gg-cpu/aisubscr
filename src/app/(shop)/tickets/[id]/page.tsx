import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketReplyForm } from "@/components/TicketReplyForm";
import { AccountFrame } from "@/components/AccountFrame";
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
    <AccountFrame current="tickets">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">{zh.ticket.title}</p>
          <h1 className="page-title" style={{ margin: 0 }}>
            {ticket.subject}
          </h1>
        </div>
        <StatusBadge status={ticket.status} kind="ticket" />
      </div>
      <div className="muted">
        订单{" "}
        <Link href={`/orders/${ticket.orderId}`} style={{ color: "var(--primary)" }}>
          {ticket.order.orderNo}
        </Link>
      </div>
      <div className="stack">
        {ticket.replies.map((reply) => (
          <div key={reply.id} className="card" style={{ padding: "1rem" }}>
            <div className="row" style={{ marginBottom: "0.35rem" }}>
              <span className="badge badge-example">{reply.isStaff ? "客服" : "我"}</span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {reply.createdAt.toISOString().replace("T", " ").slice(0, 19)}
              </span>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{reply.body}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: "1.1rem" }}>
        <TicketReplyForm ticketId={ticket.id} />
      </div>
    </AccountFrame>
  );
}
