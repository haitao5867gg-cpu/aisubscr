import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
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
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/login?next=/admin");
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/");
    throw error;
  }
  const zh = getDict(await getLocale());
  const links = [
    { href: "/admin", label: zh.admin.overview },
    { href: "/admin/orders", label: zh.admin.orders },
    { href: "/admin/products", label: zh.admin.products },
    { href: "/admin/users", label: zh.admin.users },
    { href: "/admin/audit", label: zh.admin.audit },
    { href: "/admin/tickets", label: zh.admin.tickets },
    { href: "/admin/blog", label: zh.admin.blog },
    { href: "/admin/settings", label: zh.admin.settings },
  ];

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
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="stack">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
