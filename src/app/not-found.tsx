import Link from "next/link";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export default async function NotFound() {
  const t = getDict(await getLocale());
  return (
    <main className="container" style={{ padding: "4rem 1rem" }}>
      <p className="eyebrow">404</p>
      <h1 className="page-title">{t.common.notFoundTitle}</h1>
      <p className="page-desc">{t.common.notFoundBody}</p>
      <Link href="/" className="btn btn-primary">
        {t.nav.home}
      </Link>
    </main>
  );
}
