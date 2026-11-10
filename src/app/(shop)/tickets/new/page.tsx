import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountFrame } from "@/components/AccountFrame";
import { TicketForm } from "@/components/TicketForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { pageMeta } from "@/lib/seo";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.ticket.newTicket, description: t.ticket.lead, path: "/tickets/new", index: false });
}

export default async function NewTicketPage() {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login?next=/tickets/new");
  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, orderNo: true },
  });
  return (
    <AccountFrame current="tickets">
      <div>
        <h1 className="page-title">{t.ticket.newTicket}</h1>
        <p className="page-desc">{t.ticket.lead}</p>
      </div>
      <TicketForm orders={orders} />
    </AccountFrame>
  );
}
