import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { zh } from "@/i18n/zh";

export default function RegisterPage() {
  return (
    <div>
      <AuthForm mode="register" />
      <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link href="/login">{zh.auth.hasAccount}</Link>
      </p>
    </div>
  );
}
