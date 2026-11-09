import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { zh } from "@/i18n/zh";

const links = [
  { href: "/admin", label: zh.admin.title },
  { href: "/admin/products", label: zh.admin.products },
  { href: "/admin/orders", label: zh.admin.orders },
  { href: "/admin/tickets", label: zh.admin.tickets },
  { href: "/admin/blog", label: zh.admin.blog },
  { href: "/admin/settings", label: zh.admin.settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login?next=/admin");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <>
      <Header />
      <main className="container" style={{ padding: "1.5rem 1rem 3rem", minHeight: "70vh" }}>
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
