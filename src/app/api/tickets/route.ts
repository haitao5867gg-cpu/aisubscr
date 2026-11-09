import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const tickets = await prisma.ticket.findMany({
    where: { userId: session.userId },
    include: { order: true, replies: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tickets });
}

const schema = z.object({
  orderId: z.string(),
  subject: z.string().min(2),
  body: z.string().min(2),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const body = schema.parse(await req.json());
  const order = await prisma.order.findFirst({
    where: { id: body.orderId, userId: session.userId },
  });
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  const ticket = await prisma.ticket.create({
    data: {
      orderId: order.id,
      userId: session.userId,
      subject: body.subject,
      replies: {
        create: {
          userId: session.userId,
          body: body.body,
          isStaff: false,
        },
      },
    },
    include: { replies: true },
  });
  return NextResponse.json({ ticket });
}
