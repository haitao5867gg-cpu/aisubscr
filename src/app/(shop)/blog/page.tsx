import Link from "next/link";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";
import { ArticleSearch } from "@/components/ArticleSearch";

export const dynamic = "force-dynamic";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const posts = await prisma.blogPost.findMany({
    where: {
      published: true,
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { summary: { contains: q } },
              { content: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="stack">
      <h1 className="page-title">{zh.blog.title}</h1>
      <ArticleSearch />
      {q && <p className="muted">搜索：{q} · {posts.length} 篇</p>}
      {!posts.length && <p className="muted">{zh.blog.empty}</p>}
      {posts.map((p) => (
        <Link key={p.id} href={`/blog/${p.slug}`} className="card" style={{ padding: "1.2rem", display: "block" }}>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {p.createdAt.toISOString().slice(0, 10)}
          </div>
          <strong>{p.title}</strong>
          <div className="muted" style={{ fontSize: "0.92rem", marginTop: "0.35rem" }}>
            {p.summary}
          </div>
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
            {p.authorName} · {zh.blog.readMore}
          </div>
        </Link>
      ))}
    </div>
  );
}
