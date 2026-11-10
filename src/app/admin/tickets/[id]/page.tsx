import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTicketControls } from "@/components/AdminTicketControls";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketImages } from "@/components/TicketImages";
import { TicketReplyForm } from "@/components/TicketReplyForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { presentAttachment } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const [ticket, admins] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true } },
        order: { select: { id: true, orderNo: true } },
        replies: {
          orderBy: { createdAt: "asc" },
          include: { attachments: { orderBy: { createdAt: "asc" } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN", disabled: false },
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    }),
  ]);
  if (!ticket) notFound();
  const category = t.ticket.categories[ticket.category as keyof typeof t.ticket.categories] || ticket.category;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">
            <Link href="/admin/tickets" className="text-link">{t.admin.tickets}</Link>
          </p>
          <h1 className="page-title" style={{ margin: 0 }}>{ticket.subject}</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {ticket.user.name || ticket.user.email} · {ticket.user.email} · {category}
            {ticket.order ? (
              <>
                {" · "}
                <Link href={`/admin/orders/${ticket.order.id}`} className="text-link">{ticket.order.orderNo}</Link>
              </>
            ) : null}
          </p>
        </div>
        <StatusBadge status={ticket.status} kind="ticket" />
      </div>
      <AdminTicketControls
        ticketId={ticket.id}
        status={ticket.status}
        assigneeId={ticket.assigneeId}
        admins={admins.map((admin) => ({ id: admin.id, label: admin.name || admin.email }))}
      />
      <section className="stack" aria-label={t.ticket.thread}>
        {ticket.replies.map((reply) => (
          <article key={reply.id} className={reply.internal ? "card ticket-note" : "card"} style={{ padding: "1rem" }}>
            <div className="row" style={{ marginBottom: "0.35rem" }}>
              <span className="badge badge-example">{reply.internal ? t.ticket.internalBadge : reply.isStaff ? t.shop.staff : t.shop.customer}</span>
              <time className="muted" dateTime={reply.createdAt.toISOString()}>
                {reply.createdAt.toISOString().replace("T", " ").slice(0, 19)}
              </time>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{reply.body}</div>
            <TicketImages items={reply.attachments.map((item) => presentAttachment(item))} alt={t.ticket.attachmentAlt} />
          </article>
        ))}
      </section>
      <div className="card" style={{ padding: "1.1rem" }}>
        <TicketReplyForm ticketId={ticket.id} admin />
      </div>
    </div>
  );
}
