import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await prisma.siteSetting.create({ data: { id: "default" } });
  }
  return NextResponse.json({ settings });
}
