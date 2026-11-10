import Link from "next/link";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function AccountFrame({
  current,
  children,
}: {
  current: "home" | "orders" | "tickets";
  children: React.ReactNode;
}) {
  const zh = getDict(await getLocale());
  const items = [
    { id: "home" as const, href: "/account", label: zh.nav.account },
    { id: "orders" as const, href: "/orders", label: zh.nav.orders },
    { id: "tickets" as const, href: "/tickets", label: zh.nav.tickets },
  ];

  return (
    <div className="account-grid">
      <nav className="card side-nav" aria-label={zh.nav.account}>
        {items.map((item) => (
          <Link key={item.id} href={item.href} className={item.id === current ? "active" : ""}>
            {item.label}
          </Link>
        ))}
        <Link href="/cart">{zh.shop.checkoutTitle}</Link>
      </nav>
      <div className="stack">{children}</div>
    </div>
  );
}
