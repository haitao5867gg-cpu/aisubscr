import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
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

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const entries = await prisma.faqEntry.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.admin.invalidFaq }, { status: 400 });
  const actor = actorFrom(session);
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.faqEntry.create({
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        sortOrder: parsed.data.sortOrder ?? 0,
        published: parsed.data.published ?? true,
      },
    });
    await writeAudit(tx, {
      ...actor,
      action: "faq.create",
      targetType: "faq",
      targetId: created.id,
      after: snapshot(created),
    });
    return created;
  });
  return NextResponse.json({ entry });
}
