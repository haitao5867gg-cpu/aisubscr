import Link from "next/link";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function NotFoundCard() {
  const t = getDict(await getLocale());
  return (
    <div className="card empty-state">
      <p className="eyebrow" style={{ margin: 0 }}>
        404
      </p>
      <h1 className="page-title">{t.common.notFoundTitle}</h1>
      <p className="muted">{t.common.notFoundBody}</p>
      <div className="row">
        <Link href="/products" className="btn btn-primary">
          {t.shop.emptyCta}
        </Link>
        <Link href="/" className="btn btn-secondary">
          {t.nav.home}
        </Link>
      </div>
    </div>
  );
}
