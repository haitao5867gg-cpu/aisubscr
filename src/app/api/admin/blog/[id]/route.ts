import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actorFrom, writeAudit } from "@/lib/audit";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

function postSnapshot(post: {
  id: string;
  slug: string;
  title: string;
  summary: string;
  published: boolean;
  authorName: string;
}) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    published: post.published,
    authorName: post.authorName,
  };
}

const schema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  published: z.boolean().optional(),
  authorName: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请检查文章内容" }, { status: 400 });
  const before = await prisma.blogPost.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  const actor = actorFrom(session);
  const post = await prisma.$transaction(async (tx) => {
    const updated = await tx.blogPost.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      ...actor,
      action: "blog.update",
      targetType: "blog",
      targetId: id,
      before: postSnapshot(before),
      after: postSnapshot(updated),
    });
    return updated;
  });
  return NextResponse.json({ post });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const before = await prisma.blogPost.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  const actor = actorFrom(session);
  await prisma.$transaction(async (tx) => {
    await tx.blogPost.delete({ where: { id } });
    await writeAudit(tx, {
      ...actor,
      action: "blog.delete",
      targetType: "blog",
      targetId: id,
      before: postSnapshot(before),
      after: null,
    });
  });
  return NextResponse.json({ ok: true });
}
