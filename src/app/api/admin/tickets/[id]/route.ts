import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { TICKET_STATUSES } from "@/lib/tickets";

const schema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  assigneeId: z.string().trim().min(1).max(80).nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const t = getDict(await getLocale());
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, name: true } },
      assignee: { select: { id: true, email: true, name: true } },
      order: { select: { id: true, orderNo: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { attachments: true, user: { select: { name: true, email: true, role: true } } },
      },
    },
  });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });
  return NextResponse.json({ ticket });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.admin.invalidStatus }, { status: 400 });
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: t.api.ticketMissing }, { status: 404 });

  const data: { status?: string; assigneeId?: string | null } = {};
  if (parsed.data.status && parsed.data.status !== ticket.status) data.status = parsed.data.status;
  if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== ticket.assigneeId) {
    if (parsed.data.assigneeId) {
      const admin = await prisma.user.findFirst({
        where: { id: parsed.data.assigneeId, role: "ADMIN", disabled: false },
        select: { id: true },
      });
      if (!admin) return NextResponse.json({ error: t.admin.userMissing }, { status: 400 });
    }
    data.assigneeId = parsed.data.assigneeId;
  }
  if (!data.status && data.assigneeId === undefined) {
    return NextResponse.json({ ticket: { id: ticket.id, status: ticket.status, assigneeId: ticket.assigneeId } });
  }

  const actor = actorFrom(session);
  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id }, data });
    if (data.status) {
      await writeAudit(tx, {
        ...actor,
        action: "ticket.status",
        targetType: "ticket",
        targetId: id,
        before: { status: ticket.status },
        after: { status: data.status },
      });
    }
    if (data.assigneeId !== undefined) {
      await writeAudit(tx, {
        ...actor,
        action: "ticket.assign",
        targetType: "ticket",
        targetId: id,
        before: { assigneeId: ticket.assigneeId },
        after: { assigneeId: data.assigneeId },
      });
    }
    return updated;
  });
  return NextResponse.json({ ticket: { id: saved.id, status: saved.status, assigneeId: saved.assigneeId } });
}
