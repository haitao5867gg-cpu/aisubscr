import Link from "next/link";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";
import { ArticleSearch } from "@/components/ArticleSearch";

export const dynamic = "force-dynamic";

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const posts = await prisma.blogPost.findMany({
    where: {
      published: true,
      ...(q
        ? {
            OR: [{ title: { contains: q } }, { summary: { contains: q } }, { content: { contains: q } }],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="reading stack">
      <div>
        <p className="eyebrow">{zh.shop.guideLink}</p>
        <h1 className="page-title">{zh.blog.title}</h1>
        <p className="page-desc">{zh.shop.blogLead}</p>
      </div>
      <ArticleSearch />
      {q && (
        <p className="muted">
          搜索：{q} · {posts.length} 篇
        </p>
      )}
      {!posts.length && <p className="muted">{zh.blog.empty}</p>}
      <div className="card">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`} className="ledger-row">
            <strong>{post.title}</strong>
            <span className="muted">{post.summary}</span>
            <span className="muted">{post.createdAt.toISOString().slice(0, 10)}</span>
            <span className="muted">{zh.blog.readMore}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
