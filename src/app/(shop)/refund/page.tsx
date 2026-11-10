import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.refundTitle, description: t.seo.refundDescription, path: "/refund" });
}

export default async function RefundPage() {
  const t = getDict(await getLocale());
  return <LegalDocument title={t.legal.refundTitle} lead={t.legal.refundLead} sections={t.legal.refund} />;
}
