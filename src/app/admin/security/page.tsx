import { redirect } from "next/navigation";
import { AdminTotpForm } from "@/components/AdminTotpForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/session";
import { adminTotpState } from "@/lib/totp-policy";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || session.role !== "ADMIN") redirect("/login?next=/admin/security");
  const state = await adminTotpState(session.userId);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">{t.admin.security}</h1>
        <p className="page-desc">{state.blocked ? t.admin.totpMustEnroll : t.admin.totpLead}</p>
      </div>
      <AdminTotpForm enabled={state.enabled} required={state.required} />
    </div>
  );
}
