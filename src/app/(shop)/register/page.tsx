import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.registerTitle, description: t.seo.registerDescription, path: "/register" });
}
import { normalizeEmail } from "@/lib/email";

function safeNext(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}

function prefillEmail(value?: string) {
  if (!value) return "";
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return "";
  return email;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const zh = getDict(await getLocale());
  const { next, email } = await searchParams;
  const dest = safeNext(next);
  return (
    <div className="auth-grid">
      <div>
        <p className="eyebrow">{zh.nav.register}</p>
        <h1 className="page-title">{zh.auth.registerTitle}</h1>
        <p className="text-secondary">{zh.shop.authLead}</p>
        <ul className="plain-list">
          <li>{zh.shop.authPoint1}</li>
          <li>{zh.shop.authPoint2}</li>
          <li>{zh.shop.authPoint3}</li>
        </ul>
      </div>
      <div>
        <AuthForm mode="register" next={dest} initialEmail={prefillEmail(email)} />
        <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href={`/login?next=${encodeURIComponent(dest)}`}>{zh.auth.hasAccount}</Link>
        </p>
      </div>
    </div>
  );
}
