import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { zh } from "@/i18n/zh";

function safeNext(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  return (
    <div className="auth-grid">
      <div>
        <p className="eyebrow">{zh.nav.login}</p>
        <h1 className="page-title">{zh.auth.loginTitle}</h1>
        <p className="text-secondary">{zh.shop.authLead}</p>
        <ul className="plain-list">
          <li>{zh.shop.authPoint1}</li>
          <li>{zh.shop.authPoint2}</li>
          <li>{zh.shop.authPoint3}</li>
        </ul>
      </div>
      <div>
        <AuthForm mode="login" next={dest} />
        <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href={`/register?next=${encodeURIComponent(dest)}`}>{zh.auth.noAccount}</Link>
        </p>
      </div>
    </div>
  );
}
