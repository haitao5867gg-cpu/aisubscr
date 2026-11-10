import Link from "next/link";
import { analyticsSummary } from "@/lib/analytics";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = getDict(await getLocale());
  const params = await searchParams;
  const raw = Array.isArray(params.range) ? params.range[0] : params.range;
  const days = raw === "30" ? 30 : 7;
  const summary = await analyticsSummary(days);
  const peak = Math.max(1, ...summary.daysSeries.map((column) => column.views));
  const funnel = [
    [t.admin.funnelProduct, summary.funnel.product],
    [t.admin.funnelCart, summary.funnel.cart],
    [t.admin.funnelCheckout, summary.funnel.checkout],
    [t.admin.funnelPaid, summary.funnel.paid],
  ] as const;
  const devices = [
    [t.admin.deviceMobile, summary.devices.mobile],
    [t.admin.deviceTablet, summary.devices.tablet],
    [t.admin.deviceDesktop, summary.devices.desktop],
  ] as const;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{t.admin.analytics}</h1>
          <p className="page-desc">{t.admin.analyticsLead}</p>
        </div>
        <nav className="row" aria-label={t.admin.analytics}>
          <Link href="/admin/analytics?range=7" className={days === 7 ? "btn btn-primary" : "btn btn-secondary"} aria-current={days === 7 ? "page" : undefined}>
            {t.admin.days7}
          </Link>
          <Link href="/admin/analytics?range=30" className={days === 30 ? "btn btn-primary" : "btn btn-secondary"} aria-current={days === 30 ? "page" : undefined}>
            {t.admin.days30}
          </Link>
        </nav>
      </div>
      <div className="stat-grid">
        <article className="card stat-card">
          <h2>{t.admin.visitors}</h2>
          <p className="stat-num">{summary.visitors}</p>
        </article>
        <article className="card stat-card">
          <h2>{t.admin.pageViews}</h2>
          <p className="stat-num">{summary.pageViews}</p>
        </article>
      </div>
      <section className="card chart-card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>{t.admin.dailyViews}</h2>
        {!summary.daysSeries.length && <p className="muted">{t.admin.empty}</p>}
        {summary.daysSeries.length > 0 && (
          <div className="chart-scroll">
            <div
              className="chart chart-wide"
              style={{ ["--cols" as string]: summary.daysSeries.length }}
              role="img"
              aria-label={summary.daysSeries.map((column) => `${column.day} ${column.views}`).join(t.common.listSep)}
            >
              {summary.daysSeries.map((column) => (
                <div key={column.day} className="chart-col">
                  <strong>{column.views}</strong>
                  <div className="chart-bar" style={{ height: `${Math.max(8, Math.round((column.views / peak) * 120))}px` }} />
                  <span>{column.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="stack">
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{t.admin.funnel}</h2>
        <p className="muted" style={{ margin: 0 }}>{t.admin.funnelLead}</p>
        <div className="funnel">
          {funnel.map(([label, count]) => (
            <article key={label} className="card stat-card">
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{label}</h3>
              <p className="stat-num">{count}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="detail-grid">
        <section className="card" style={{ padding: "1rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>{t.admin.topPages}</h2>
          {!summary.topPages.length && <p className="muted">{t.admin.empty}</p>}
          <ol className="stack" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {summary.topPages.map((page) => (
              <li key={page.path}>
                <span className="text-link">{page.path}</span> <span className="muted">{page.views}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="card" style={{ padding: "1rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>{t.admin.topReferrers}</h2>
          {!summary.topReferrers.length && <p className="muted">{t.admin.noReferrers}</p>}
          <ol className="stack" style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {summary.topReferrers.map((row) => (
              <li key={row.domain}>{row.domain} <span className="muted">{row.views}</span></li>
            ))}
          </ol>
          <h3 style={{ margin: "1rem 0 0.4rem", fontSize: "0.95rem" }}>{t.admin.devices}</h3>
          <p style={{ margin: 0 }}>
            {devices.map(([label, count]) => `${label} ${count}`).join(" · ")}
          </p>
        </section>
      </div>
    </div>
  );
}
