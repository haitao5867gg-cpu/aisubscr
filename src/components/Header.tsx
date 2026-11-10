import { getSession } from "@/lib/session";
import { getPublicSettings } from "@/lib/public-content";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { ShopHeader } from "./ShopHeader";

export async function Header() {
  const zh = getDict(await getLocale());
  const session = await getSession();
  const settings = await getPublicSettings();
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
