import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { zh } from "@/i18n/zh";

export default function LoginPage() {
  return (
    <div>
      <AuthForm mode="login" />
      <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link href="/register">{zh.auth.noAccount}</Link>
      </p>
    </div>
  );
}
