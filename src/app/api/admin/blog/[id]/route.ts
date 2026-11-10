import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

const schema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  published: z.boolean().optional(),
  authorName: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const body = schema.parse(await req.json());
  const post = await prisma.blogPost.update({ where: { id }, data: body });
  return NextResponse.json({ post });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  await prisma.blogPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
