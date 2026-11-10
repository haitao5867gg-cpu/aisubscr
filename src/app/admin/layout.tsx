import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/session";
import { adminTotpState } from "@/lib/totp-policy";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.admin.title, description: t.admin.lead, path: "/admin", index: false });
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireAdminUser();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/login?next=/admin");
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/");
    throw error;
  }
  const totp = session.userId ? await adminTotpState(session.userId) : { enabled: false, required: false, blocked: false };
  const path = (await headers()).get("x-pathname") ?? "";
  if (totp.blocked && path !== "/admin/security") redirect("/admin/security");
  const zh = getDict(await getLocale());
  const links = [
    { href: "/admin", label: zh.admin.overview },
    { href: "/admin/analytics", label: zh.admin.analytics },
    { href: "/admin/orders", label: zh.admin.orders },
    { href: "/admin/products", label: zh.admin.products },
    { href: "/admin/users", label: zh.admin.users },
    { href: "/admin/audit", label: zh.admin.audit },
    { href: "/admin/tickets", label: zh.admin.tickets },
    { href: "/admin/blog", label: zh.admin.blog },
    { href: "/admin/coupons", label: zh.admin.coupons },
    { href: "/admin/faq", label: zh.admin.faq },
    { href: "/admin/settings", label: zh.admin.settings },
    { href: "/admin/security", label: zh.admin.security },
  ];
  const current = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

  return (
    <>
      <a className="skip-link" href="#main">
        {zh.common.skipToContent}
      </a>
      <Header />
      <main id="main" className="container main-pad" style={{ paddingTop: "1.5rem", minHeight: "70vh" }}>
        <div className="admin-shell">
          <nav className="card side-nav" aria-label={zh.admin.title}>
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={current(link.href) ? "active" : undefined} aria-current={current(link.href) ? "page" : undefined}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="stack">
            {!totp.enabled && (
              <div className="alert alert-mock" role="status">
                {totp.blocked ? zh.admin.totpMustEnroll : zh.admin.totpEncourage}{" "}
                {path !== "/admin/security" && (
                  <Link href="/admin/security" className="text-link">
                    {zh.admin.totpSetupLink}
                  </Link>
                )}
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
