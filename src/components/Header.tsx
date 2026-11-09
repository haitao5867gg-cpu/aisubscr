import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";
import { ShopHeader } from "./ShopHeader";

export async function Header() {
  const session = await getSession();
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const cartCount = (session.cart || []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <ShopHeader
      siteName={settings?.siteName || zh.siteName}
      cartCount={cartCount}
      loggedIn={Boolean(session.isLoggedIn)}
      isAdmin={session.role === "ADMIN"}
      displayName={session.name || session.email}
    />
  );
}
