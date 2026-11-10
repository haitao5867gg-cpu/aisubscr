import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AccountFrame } from "@/components/AccountFrame";
import { ChangeEmailForm } from "@/components/ChangeEmailForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({
    title: t.seo.securityTitle,
    description: t.seo.securityDescription,
    path: "/account/security",
    index: false,
  });
}

export default async function AccountSecurityPage() {
  const zh = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || !session.email) redirect("/login?next=/account/security");

  return (
    <AccountFrame current="security">
      <div>
        <p className="eyebrow">{zh.nav.account}</p>
        <h1 className="page-title">{zh.security.security}</h1>
        <p className="page-desc">{zh.security.securityLead}</p>
      </div>
      <ChangePasswordForm />
      <ChangeEmailForm currentEmail={session.email} />
    </AccountFrame>
  );
}
