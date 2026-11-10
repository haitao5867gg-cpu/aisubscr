import type { Metadata } from "next";
import Link from "next/link";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { getPublishedFaqs } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.helpTitle, description: t.seo.helpDescription, path: "/help" });
}

export default async function HelpPage() {
  const t = getDict(await getLocale());
  const entries = await getPublishedFaqs();
  return (
    <div className="reading stack">
      <h1 className="page-title">{t.help.title}</h1>
      <p className="page-desc">{t.help.lead}</p>
      {!entries.length && (
        <div className="card stack" style={{ padding: "1.2rem" }}>
          <p style={{ margin: 0 }}>{t.help.empty}</p>
          <Link href="/contact" className="btn btn-secondary">
            {t.footer.contact}
          </Link>
        </div>
      )}
      {entries.map((entry, index) => (
        <details key={entry.id} className="faq-item" open={index === 0}>
          <summary>{entry.question}</summary>
          <p>{entry.answer}</p>
        </details>
      ))}
    </div>
  );
}
