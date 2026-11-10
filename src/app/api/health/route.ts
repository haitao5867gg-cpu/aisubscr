import { readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logApiError, requestIdFrom } from "@/lib/server-log";

export const dynamic = "force-dynamic";

function version() {
  const fromEnv = process.env.APP_VERSION?.trim() ?? "";
  if (fromEnv && fromEnv.length <= 64 && /^[A-Za-z0-9._+-]+$/.test(fromEnv)) return fromEnv;
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string };
    return typeof pkg.version === "string" && pkg.version ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function commit() {
  const raw = (process.env.GIT_COMMIT || process.env.SOURCE_COMMIT || "").trim();
  if (/^[0-9a-f]{7,40}$/i.test(raw)) return raw;
  return null;
}

/**
 * Cheap liveness check for uptime probes. The body is only ok, db, version, and commit.
 * Middleware skips CSP and does not rate-limit this path.
 */
export async function GET(req: NextRequest) {
  const requestId = requestIdFrom(req.headers);
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (error) {
    logApiError({ requestId, route: "/api/health", status: 503, error });
    db = false;
  }
  return NextResponse.json(
    { ok: db, db, version: version(), commit: commit() },
    {
      status: db ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}
