import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketImages } from "@/components/TicketImages";
import { TicketReplyForm } from "@/components/TicketReplyForm";
import { AccountFrame } from "@/components/AccountFrame";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { customerReplies, presentAttachment } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.ticketsTitle, description: t.seo.ticketsDescription, path: "/tickets", index: false });
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const zh = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect(`/login?next=/tickets/${id}`);
  const ticket = await prisma.ticket.findFirst({
    where: { id, userId: session.userId },
    include: {
      order: { select: { id: true, orderNo: true } },
      replies: customerReplies,
    },
  });
  if (!ticket) notFound();
  const category = (zh.ticket.categories as Record<string, string>)[ticket.category] || ticket.category;
  const waiting = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <AccountFrame current="tickets">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">{zh.ticket.title}</p>
          <h1 className="page-title" style={{ margin: 0 }}>{ticket.subject}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>{category}</p>
        </div>
        <StatusBadge status={ticket.status} kind="ticket" />
      </div>
      {ticket.order && (
        <div className="muted">
          {zh.shop.orderRef}{" "}
          <Link href={`/orders/${ticket.order.id}`} className="text-link">{ticket.order.orderNo}</Link>
        </div>
      )}
      <section className="stack" aria-label={zh.ticket.thread}>
        {ticket.replies.map((reply) => (
          <article key={reply.id} className="card" style={{ padding: "1rem" }}>
            <div className="row" style={{ marginBottom: "0.35rem" }}>
              <span className="badge badge-example">{reply.isStaff ? zh.shop.staff : zh.shop.me}</span>
              <time className="muted" style={{ fontSize: "0.8rem" }} dateTime={reply.createdAt.toISOString()}>
                {reply.createdAt.toISOString().replace("T", " ").slice(0, 19)}
              </time>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{reply.body}</div>
            <TicketImages items={reply.attachments.map((item) => presentAttachment(item))} alt={zh.ticket.attachmentAlt} />
          </article>
        ))}
      </section>
      <div className="card" style={{ padding: "1.1rem" }}>
        {waiting && <p className="muted" style={{ marginTop: 0 }}>{zh.ticket.reopenHint}</p>}
        <TicketReplyForm ticketId={ticket.id} />
      </div>
    </AccountFrame>
  );
}
