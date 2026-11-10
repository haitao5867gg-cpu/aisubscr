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
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products });
}

const schema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().positive(),
  isSubscription: z.boolean().optional(),
  active: z.boolean().optional(),
  imageUrl: z.string().optional(),
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
  const product = await prisma.product.create({ data: body });
  return NextResponse.json({ product });
}
