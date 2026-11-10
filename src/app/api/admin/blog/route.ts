import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { refreshPublic } from "@/lib/public-content";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ posts });
}

const schema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  content: z.string().min(1),
  published: z.boolean().optional(),
  authorName: z.string().optional(),
});

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

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const t = getDict(await getLocale());
  if (!parsed.success) return NextResponse.json({ error: t.api.postInvalid }, { status: 400 });
  const actor = actorFrom(session);
  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.blogPost.create({ data: parsed.data });
    await writeAudit(tx, {
      ...actor,
      action: "blog.create",
      targetType: "blog",
      targetId: created.id,
      after: postSnapshot(created),
    });
    return created;
  });
  refreshPublic("blog");
  return NextResponse.json({ post });
}
