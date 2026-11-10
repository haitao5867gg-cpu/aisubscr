import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuthResponse, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
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

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const body = schema.parse(await req.json());
  const post = await prisma.blogPost.create({ data: body });
  return NextResponse.json({ post });
}
