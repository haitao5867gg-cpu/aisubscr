import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
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

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "aisubscr-dev-session-secret-change-in-production-32chars",
  cookieName: "aisubscr_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
  },
};

async function openSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
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
 * The cart is left intact. Cookie writes happen only in route handlers.
 */
export async function getSession() {
  const session = await openSession();
  if (!session.isLoggedIn || !session.userId) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sessionVersion: true },
  });
  const presented = typeof session.sessionVersion === "number" ? session.sessionVersion : 0;
  if (!user || user.sessionVersion !== presented) {
    clearIdentity(session);
  }
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
