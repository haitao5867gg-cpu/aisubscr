import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export default async function ShopLoading() {
  const t = getDict(await getLocale());
  return (
    <p className="muted" aria-busy="true" aria-live="polite">
      {t.common.loading}
    </p>
  );
}
