import Link from "next/link";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";

export async function Footer() {
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const year = new Date().getFullYear();
  return (
    <footer style={{ marginTop: "3rem", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="container" style={{ padding: "2.25rem var(--pad-x)" }}>
        <div className="footer-grid" style={{ marginBottom: "1.75rem" }}>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.guides}</strong>
            <Link href="/blog" className="muted">{zh.footer.faq}</Link>
            <Link href="/blog/how-to-order" className="muted">{zh.footer.guides}</Link>
            <Link href="/blog" className="muted">{zh.footer.rss}</Link>
          </div>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.products}</strong>
            <Link href="/products" className="muted">{zh.nav.subscribe}</Link>
            <Link href="/cart" className="muted">{zh.nav.cart}</Link>
            <Link href="/orders" className="muted">{zh.nav.orders}</Link>
          </div>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.blog}</strong>
            <Link href="/blog" className="muted">{zh.blog.title}</Link>
            <Link href="/blog/welcome" className="muted">欢迎使用</Link>
          </div>
          <div className="stack" style={{ gap: "0.45rem" }}>
            <strong>{zh.footer.support}</strong>
            <span className="muted" style={{ fontSize: "0.9rem" }}>
              {zh.support.email}：{settings?.supportEmail || "support@example.com"}
            </span>
            <span className="muted" style={{ fontSize: "0.9rem" }}>
              {zh.support.hours}：{settings?.supportHours || "08:00–23:00"}
            </span>
            <Link href="/tickets" className="muted">{zh.nav.tickets}</Link>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            © {year} {settings?.siteName || zh.siteName}
          </span>
          <span className="badge badge-example">{zh.common.exampleData}</span>
        </div>
        <p className="muted" style={{ fontSize: "0.8rem", margin: 0, maxWidth: "52rem" }}>
          {settings?.footerText || zh.footer.disclaimer}
        </p>
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.65rem" }}>
          {zh.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
