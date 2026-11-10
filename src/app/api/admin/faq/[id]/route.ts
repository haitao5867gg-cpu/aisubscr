import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { refreshPublic } from "@/lib/public-content";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

const schema = z.object({
  question: z.string().trim().min(2).max(200),
  answer: z.string().trim().min(2).max(4000),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  published: z.boolean().optional(),
});

function snapshot(row: { question: string; answer: string; sortOrder: number; published: boolean }) {
  return {
    question: row.question,
    answer: row.answer,
    sortOrder: row.sortOrder,
    published: row.published,
  };
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
  if (!parsed.success) return NextResponse.json({ error: t.admin.invalidFaq }, { status: 400 });
  const before = await prisma.faqEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.admin.faqMissing }, { status: 404 });
  const actor = actorFrom(session);
  const entry = await prisma.$transaction(async (tx) => {
    const saved = await tx.faqEntry.update({
      where: { id },
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        sortOrder: parsed.data.sortOrder ?? before.sortOrder,
        published: parsed.data.published ?? before.published,
      },
    });
    await writeAudit(tx, {
      ...actor,
      action: "faq.update",
      targetType: "faq",
      targetId: id,
      before: snapshot(before),
      after: snapshot(saved),
    });
    return saved;
  });
  refreshPublic("help");
  return NextResponse.json({ entry });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const before = await prisma.faqEntry.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.admin.faqMissing }, { status: 404 });
  const actor = actorFrom(session);
  await prisma.$transaction(async (tx) => {
    await tx.faqEntry.delete({ where: { id } });
    await writeAudit(tx, {
      ...actor,
      action: "faq.delete",
      targetType: "faq",
      targetId: id,
      before: snapshot(before),
    });
  });
  refreshPublic("help");
  return NextResponse.json({ ok: true });
}
