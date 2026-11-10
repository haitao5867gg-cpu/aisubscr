import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function LegalDocument({
  title,
  lead,
  sections,
}: {
  title: string;
  lead: string;
  sections: readonly { heading: string; body: string }[];
}) {
  const t = getDict(await getLocale());
  return (
    <article className="reading stack">
      <div className="review-banner" role="note">
        {t.legal.review}
      </div>
      <h1 className="page-title">{title}</h1>
      <p className="page-desc">{lead}</p>
      {sections.map((section) => (
        <section key={section.heading} className="stack" style={{ gap: "0.35rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{section.heading}</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>{section.body}</p>
        </section>
      ))}
    </article>
  );
}
