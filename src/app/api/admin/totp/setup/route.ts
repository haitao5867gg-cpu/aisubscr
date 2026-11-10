import { NextResponse } from "next/server";
import { beginTotpEnrollment } from "@/lib/admin-totp";
import { adminAuthResponse, requireAdminUser } from "@/lib/session";

export async function POST() {
  let session;
  try {
    session = await requireAdminUser();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  if (!session.userId || !session.email) {
    const denied = await adminAuthResponse(new Error("UNAUTHORIZED"));
    return denied ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const enrollment = await beginTotpEnrollment({ id: session.userId, email: session.email });
  return NextResponse.json(enrollment);
}
