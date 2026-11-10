import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.privacyTitle, description: t.seo.privacyDescription, path: "/privacy" });
}

export default async function PrivacyPage() {
  const t = getDict(await getLocale());
  return <LegalDocument title={t.legal.privacyTitle} lead={t.legal.privacyLead} sections={t.legal.privacy} />;
}
