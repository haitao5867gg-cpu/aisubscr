import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q } }],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ users });
}
