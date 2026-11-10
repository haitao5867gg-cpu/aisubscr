import { AdminFaqForm } from "@/components/AdminFaqForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const t = getDict(await getLocale());
  const entries = await prisma.faqEntry.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div className="stack">
      <h1 className="page-title">{t.admin.faq}</h1>
      <p className="page-desc">{t.admin.faqLead}</p>
      <AdminFaqForm
        entries={entries.map((entry) => ({
          id: entry.id,
          question: entry.question,
          answer: entry.answer,
          sortOrder: entry.sortOrder,
          published: entry.published,
          updatedAt: entry.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
