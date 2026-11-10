import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; sqliteReady?: Promise<void> };

/**
 * socket_timeout is Prisma's SQLite busy_timeout, in seconds, applied to every pooled connection.
 * journal_mode=WAL is persistent on the file; busy_timeout is also set explicitly on startup.
 */
function withSqliteParams(raw: string) {
  if (!raw.startsWith("file:")) return raw;
  const q = raw.indexOf("?");
  const base = q === -1 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q === -1 ? "" : raw.slice(q + 1));
  if (!params.has("socket_timeout")) params.set("socket_timeout", "5");
  return `${base}?${params.toString()}`;
}

const databaseUrl = withSqliteParams(process.env.DATABASE_URL ?? "");
if (databaseUrl.startsWith("file:")) process.env.DATABASE_URL = databaseUrl;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function ensureSqlitePragmas() {
  if (!databaseUrl.startsWith("file:")) return Promise.resolve();
  globalForPrisma.sqliteReady ??= prisma
    .$queryRawUnsafe("PRAGMA journal_mode=WAL")
    .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000"))
    .then(() => undefined);
  return globalForPrisma.sqliteReady;
}

void ensureSqlitePragmas();
