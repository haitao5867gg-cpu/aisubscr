import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";

export type SessionData = {
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
  cart?: { productId: string; quantity: number }[];
  /** Copy of User.sessionVersion at login. Mismatch means the cookie is logged out. */
  sessionVersion?: number;
  isLoggedIn: boolean;
};

const DEV_SESSION_SECRET = "aisubscr-dev-session-secret-change-in-production-32chars";
const PLACEHOLDER_SECRETS = new Set([DEV_SESSION_SECRET, "change-me-to-a-long-random-string"]);

/**
 * iron-session rejects passwords shorter than 32 characters.
 * The dev fallback is public, so production must set its own secret.
 * `next build` runs with NODE_ENV=production before the server secret is needed.
 */
function sessionPassword(): string {
  const configured = process.env.SESSION_SECRET?.trim() ?? "";
  const building = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !building) {
    if (configured.length < 32 || PLACEHOLDER_SECRETS.has(configured)) {
      throw new Error("SESSION_SECRET must be a unique value of at least 32 characters");
    }
    return configured;
  }
  return configured.length >= 32 ? configured : DEV_SESSION_SECRET;
}

function ironOptions(): SessionOptions {
  return {
    password: sessionPassword(),
    cookieName: "aisubscr_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    },
  };
}

async function openSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, ironOptions());
}

function clearIdentity(session: {
  isLoggedIn?: boolean;
  userId?: string;
  email?: string;
  role?: string;
  name?: string;
  sessionVersion?: number;
}) {
  session.isLoggedIn = false;
  delete session.userId;
  delete session.email;
  delete session.role;
  delete session.name;
  delete session.sessionVersion;
}

/**
 * iron-session keeps the seal in the cookie, so other devices cannot be
 * deleted directly. A stale sessionVersion is treated as logged out.
 * Role is read from the database on each request so a demoted admin loses
 * access without waiting for the cookie to be rewritten.
 * The cart is left intact. Cookie writes happen only in route handlers.
 */
export async function getSession() {
  const session = await openSession();
  if (!session.isLoggedIn || !session.userId) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sessionVersion: true, role: true },
  });
  const presented = typeof session.sessionVersion === "number" ? session.sessionVersion : 0;
  if (!user || user.sessionVersion !== presented) {
    clearIdentity(session);
    return session;
  }
  if (session.role !== user.role) session.role = user.role;
  return session;
}

/** Persist a logout for the browser that just reset this user's password. */
export async function revokeCurrentSessionIfUser(userId: string) {
  const session = await openSession();
  if (!session.isLoggedIn || session.userId !== userId) return;
  clearIdentity(session);
  await session.save();
}

export async function requireUser() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

/** Map requireAdmin failures to HTTP responses. Other errors propagate. */
export function adminAuthResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  if (error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return null;
}
