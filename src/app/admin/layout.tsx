import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { zh } from "@/i18n/zh";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <>
      <Header />
      <main className="container" style={{ padding: "1.5rem 1rem 3rem", minHeight: "70vh" }}>
        <div className="row" style={{ marginBottom: "1.25rem", gap: "0.5rem" }}>
          <Link href="/admin" className="btn btn-secondary">
            {zh.admin.title}
          </Link>
          <Link href="/admin/products" className="btn btn-ghost">
            {zh.admin.products}
          </Link>
          <Link href="/admin/orders" className="btn btn-ghost">
            {zh.admin.orders}
          </Link>
          <Link href="/admin/tickets" className="btn btn-ghost">
            {zh.admin.tickets}
          </Link>
          <Link href="/admin/blog" className="btn btn-ghost">
            {zh.admin.blog}
          </Link>
          <Link href="/admin/settings" className="btn btn-ghost">
            {zh.admin.settings}
          </Link>
        </div>
        {children}
      </main>
      <Footer />
    </>
  );
}
