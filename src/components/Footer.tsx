import Link from "next/link";
import { getPublicSettings } from "@/lib/public-content";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function Footer() {
  const zh = getDict(await getLocale());
  const settings = await getPublicSettings();
  const year = new Date().getFullYear();
  const siteName = settings?.siteName || zh.siteName;

  return (
    <footer style={{ marginTop: "3rem", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="container" style={{ padding: "2.25rem var(--pad-x)" }}>
        <div className="footer-grid" style={{ marginBottom: "1.75rem" }}>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{siteName}</strong>
            <span className="muted" style={{ fontSize: "0.9rem" }}>
              {zh.shop.eyebrow}
            </span>
            <Link href="/blog" className="muted">
              {zh.home.ctaBlog}
            </Link>
          </div>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.products}</strong>
            <Link href="/products" className="muted">
              {zh.shop.navPlans}
            </Link>
            <Link href="/cart" className="muted">
              {zh.shop.checkoutTitle}
            </Link>
          </div>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.account}</strong>
            <Link href="/account" className="muted">
              {zh.nav.account}
            </Link>
            <Link href="/orders" className="muted">
              {zh.nav.orders}
            </Link>
            <Link href="/tickets" className="muted">
              {zh.nav.tickets}
            </Link>
          </div>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.support}</strong>
            <span className="muted" style={{ fontSize: "0.9rem" }}>
              {zh.support.email}{zh.common.colon}{settings?.supportEmail || "support@example.com"}
            </span>
            <span className="muted" style={{ fontSize: "0.9rem" }}>
              {zh.support.hours}{zh.common.colon}{settings?.supportHours || "08:00–23:00"}
            </span>
            <Link href="/help" className="muted">
              {zh.footer.help}
            </Link>
            <Link href="/contact" className="muted">
              {zh.footer.contact}
            </Link>
          </div>
        </div>
        <nav className="footer-links" aria-label={zh.footer.support}>
          <Link href="/terms" className="muted">
            {zh.footer.terms}
          </Link>
          <Link href="/privacy" className="muted">
            {zh.footer.privacy}
          </Link>
          <Link href="/refund" className="muted">
            {zh.footer.refund}
          </Link>
          <Link href="/help" className="muted">
            {zh.footer.help}
          </Link>
          <Link href="/contact" className="muted">
            {zh.footer.contact}
          </Link>
        </nav>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            © {year} {siteName}
          </span>
          <span className="badge badge-example">{zh.common.exampleData}</span>
        </div>
        <p className="muted" style={{ fontSize: "0.8rem", margin: 0, maxWidth: "52rem" }}>
          {settings?.footerText || zh.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
