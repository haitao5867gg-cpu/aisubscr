import type { Metadata } from "next";
import Link from "next/link";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { contactEmailOf } from "@/lib/site-settings";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.contactTitle, description: t.seo.contactDescription, path: "/contact" });
}

export default async function ContactPage() {
  const t = getDict(await getLocale());
  const settings = await prisma.siteSetting.findUnique({ where: { id: "default" } });
  const email = settings ? contactEmailOf(settings) : "support@example.com";
  const hours = settings?.supportHours || "08:00–23:00";
  const rows = [
    settings?.wechatId.trim() ? [t.contact.wechat, settings.wechatId.trim()] : null,
    settings?.qq.trim() ? [t.contact.qq, settings.qq.trim()] : null,
    [t.contact.email, email],
    [t.support.hours, hours],
  ].filter((row): row is [string, string] => Boolean(row));

  return (
    <div className="reading stack">
      <h1 className="page-title">{t.contact.title}</h1>
      <p className="page-desc">{t.contact.lead}</p>
      <div className="card stack" style={{ padding: "1.2rem" }}>
        {rows.map(([label, value]) => (
          <div key={label} className="money-row">
            <span className="muted">{label}</span>
            {label === t.contact.email ? (
              <a className="text-link" href={`mailto:${value}`}>
                {value}
              </a>
            ) : (
              <strong>{value}</strong>
            )}
          </div>
        ))}
        {(settings?.qrImageUrl || (settings?.qrImageData && settings.qrImageMime)) && (
          <div>
            <div className="muted" style={{ marginBottom: "0.4rem" }}>{t.contact.qr}</div>
            {/* Uploaded WebP, or the legacy same-origin QR route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings?.qrImageUrl || "/api/contact-qr"}
              alt={t.contact.qr}
              style={{ width: 180, maxWidth: "100%" }}
            />
          </div>
        )}
        <Link href="/tickets" className="btn btn-primary">
          {t.contact.tickets}
        </Link>
      </div>
    </div>
  );
}
