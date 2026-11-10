import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatShanghai } from "@/lib/admin-stats";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = await getLocale();
  const zh = getDict(locale);
  const q = (await searchParams).q?.trim() ?? "";
  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q } }] }
      : undefined,
    select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.users}</h1>
      <form className="card filter-bar" method="get">
        <div>
          <label className="label" htmlFor="user-q">{zh.admin.userSearch}</label>
          <input id="user-q" className="input" name="q" defaultValue={q} />
        </div>
        <button className="btn btn-primary" type="submit">{zh.admin.searchAction}</button>
      </form>
      {!users.length && <p className="muted">{zh.admin.empty}</p>}
      {users.length > 0 && (
        <div className="card">
          {users.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`} className="ledger-row">
              <strong>{user.email}</strong>
              <span className="muted">
                {user.name || "—"} · {user.role} · {formatShanghai(user.createdAt, locale)}
              </span>
              <span />
              <span className={user.disabled ? "badge badge-example" : "badge badge-paid"}>
                {user.disabled ? zh.admin.disabled : zh.admin.enabled}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
