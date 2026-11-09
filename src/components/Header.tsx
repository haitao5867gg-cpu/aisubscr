import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitch } from "./LanguageSwitch";

export async function Header() {
  const session = await getSession();
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const siteName = settings?.siteName || zh.siteName;
  const cartCount = (session.cart || []).reduce((s, c) => s + c.quantity, 0);

  return (
    <header className="site-header">
      <div className="container" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div className="row" style={{ gap: "1.35rem", flex: 1 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.02em", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-tint)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>A</span>
            {siteName}
          </Link>
          <nav className="row" style={{ gap: "1rem" }}>
            <Link href="/blog" className="nav-link">
              {zh.nav.blog}
            </Link>
            <Link href="/products" className="nav-link">
              {zh.nav.subscribe}
            </Link>
            <Link href={session.isLoggedIn ? "/orders" : "/login"} className="nav-link">
              {zh.nav.account}
            </Link>
            <Link href="/cart" className="nav-link">
              {zh.nav.cart}
              {cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
            {session.role === "ADMIN" && (
              <Link href="/admin" className="nav-link">
                {zh.nav.admin}
              </Link>
            )}
          </nav>
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <LanguageSwitch />
          <ThemeToggle />
          {session.isLoggedIn ? (
            <>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {session.name || session.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link">
                {zh.nav.login}
              </Link>
              <Link href="/register" className="btn btn-primary">
                {zh.nav.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
