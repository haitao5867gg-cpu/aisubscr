import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditActor = {
  actorId: string;
  actorEmail: string;
};

export type AuditEntry = AuditActor & {
  action: string;
  targetType: string;
  targetId: string;
  note?: string | null;
  before?: unknown;
  after?: unknown;
};

type AuditDb = Prisma.TransactionClient | PrismaClient;

export function actorFrom(session: { userId?: string; email?: string }): AuditActor {
  if (!session.userId || !session.email) throw new Error("UNAUTHORIZED");
  return { actorId: session.userId, actorEmail: session.email };
}

export async function writeAudit(db: AuditDb, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      note: entry.note ?? null,
      beforeJson: entry.before === undefined ? null : JSON.stringify(entry.before),
      afterJson: entry.after === undefined ? null : JSON.stringify(entry.after),
    },
  });
}
