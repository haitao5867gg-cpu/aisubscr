import { prisma } from "@/lib/db";
import { AdminBlogForm } from "@/components/AdminBlogForm";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const zh = getDict(await getLocale());
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.blog}</h1>
      <AdminBlogForm />
      {!posts.length && <p className="muted">{zh.admin.empty}</p>}
      {posts.map((p) => (
        <div key={p.id} className="card" style={{ padding: "1rem" }}>
          <strong>{p.title}</strong>
          <div className="muted">
            /blog/{p.slug} · {p.published ? zh.admin.published : zh.admin.draft}
          </div>
        </div>
      ))}
    </div>
  );
}
