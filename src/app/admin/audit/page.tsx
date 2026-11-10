import { prisma } from "@/lib/db";
import { formatShanghai } from "@/lib/admin-stats";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

function pretty(json: string | null) {
  if (!json) return null;
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

export default async function AdminAuditPage() {
  const locale = await getLocale();
  const zh = getDict(locale);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.audit}</h1>
      {!logs.length && <p className="muted">{zh.admin.auditEmpty}</p>}
      {logs.map((log) => (
        <article key={log.id} className="card" style={{ padding: "0.95rem 1rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{log.action}</strong>
            <span className="muted">{formatShanghai(log.createdAt, locale)}</span>
          </div>
          <div className="muted">
            {zh.admin.actor} {log.actorEmail} · {zh.admin.target} {log.targetType}/{log.targetId}
          </div>
          {log.note && <p style={{ margin: "0.45rem 0 0" }}>{log.note}</p>}
          {pretty(log.beforeJson) && (
            <>
              <div className="label">{zh.admin.before}</div>
              <pre className="audit-json">{pretty(log.beforeJson)}</pre>
            </>
          )}
          {pretty(log.afterJson) && (
            <>
              <div className="label">{zh.admin.after}</div>
              <pre className="audit-json">{pretty(log.afterJson)}</pre>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
