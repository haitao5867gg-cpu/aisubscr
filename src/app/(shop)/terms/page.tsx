import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.termsTitle, description: t.seo.termsDescription, path: "/terms" });
}

export default async function TermsPage() {
  const t = getDict(await getLocale());
  return <LegalDocument title={t.legal.termsTitle} lead={t.legal.termsLead} sections={t.legal.terms} />;
}
