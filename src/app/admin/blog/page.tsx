import { prisma } from "@/lib/db";
import { AdminBlogForm } from "@/components/AdminBlogForm";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.admin.blog}</h1>
      <AdminBlogForm />
      {posts.map((p) => (
        <div key={p.id} className="card" style={{ padding: "1rem" }}>
          <strong>{p.title}</strong>
          <div className="muted">
            /blog/{p.slug} · {p.published ? "已发布" : "草稿"}
          </div>
        </div>
      ))}
    </div>
  );
}
