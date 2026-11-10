"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitch } from "./LanguageSwitch";

export function ShopHeader({
  siteName,
  cartCount,
  loggedIn,
  isAdmin,
  displayName,
}: {
  siteName: string;
  cartCount: number;
  loggedIn: boolean;
  isAdmin: boolean;
  displayName?: string | null;
}) {
  const zh = useDict();
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const links = [
    { href: "/", label: zh.nav.home, on: path === "/" },
    { href: "/products", label: zh.shop.navPlans, on: path.startsWith("/products") },
    { href: "/cart", label: zh.nav.cart, on: path.startsWith("/cart"), count: cartCount },
  ];
  const accountHref = loggedIn ? "/account" : "/login?next=/account";

  return (
    <header className="site-header">
      <div className="container header-bar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            A
          </span>
          {siteName}
        </Link>
        <nav className="header-nav" aria-label={zh.common.primaryNav}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`nav-link ${link.on ? "active" : ""}`}>
              {link.label}
              {link.count ? <span className="count-pill">{link.count}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="header-spacer" />
        <div className="header-tools">
          <Link href="/blog" className={`nav-quiet desk-only ${path.startsWith("/blog") ? "active" : ""}`}>
            {zh.nav.blog}
          </Link>
          <Link href={accountHref} className={`nav-link desk-only ${path.startsWith("/account") ? "active" : ""}`}>
            {zh.nav.account}
          </Link>
          {isAdmin && (
            <Link href="/admin" className={`nav-link desk-only ${path.startsWith("/admin") ? "active" : ""}`}>
              {zh.nav.admin}
            </Link>
          )}
          <LanguageSwitch />
          <ThemeToggle />
          {loggedIn ? (
            <>
              {displayName && <span className="muted desk-only name-clip">{displayName}</span>}
              <span className="desk-only">
                <LogoutButton compact />
              </span>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link desk-only">
                {zh.nav.login}
              </Link>
              <Link href="/register" className="btn btn-primary desk-only">
                {zh.nav.register}
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost menu-btn"
            aria-expanded={open}
            aria-label={zh.common.menu}
            onClick={() => setOpen((value) => !value)}
          >
            {zh.common.menu}
          </button>
        </div>
      </div>
      {open && (
        <div className="mobile-drawer">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
              {link.count ? ` (${link.count})` : ""}
            </Link>
          ))}
          <Link href="/blog">{zh.nav.blog}</Link>
          <Link href={accountHref}>{zh.nav.account}</Link>
          {isAdmin && <Link href="/admin">{zh.nav.admin}</Link>}
          {loggedIn ? (
            <LogoutButton />
          ) : (
            <>
              <Link href="/login">{zh.nav.login}</Link>
              <Link href="/register" className="btn btn-primary">
                {zh.nav.register}
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
