import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { zh } from "@/i18n/zh";

function safeNext(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const loginHref = `/login?next=${encodeURIComponent(dest)}`;
  return (
    <div className="auth-grid">
      <div>
        <p className="eyebrow">{zh.auth.forgotTitle}</p>
        <h1 className="page-title">{zh.auth.forgotTitle}</h1>
        <p className="text-secondary">{zh.auth.forgotLead}</p>
        <ul className="plain-list">
          <li>{zh.auth.forgotPoint1}</li>
          <li>{zh.auth.forgotPoint2}</li>
          <li>{zh.auth.forgotPoint3}</li>
        </ul>
      </div>
      <div>
        <ForgotPasswordForm loginHref={loginHref} />
        <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
          <Link href={loginHref}>{zh.auth.backToLogin}</Link>
        </p>
      </div>
    </div>
  );
}
