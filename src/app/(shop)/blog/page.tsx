import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { getPublishedPosts } from "@/lib/public-content";
import { getLocale } from "@/i18n/server";
import { ArticleSearch } from "@/components/ArticleSearch";
import { EmptyState } from "@/components/EmptyState";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(await getLocale());
  return pageMeta({ title: t.seo.blogTitle, description: t.seo.blogDescription, path: "/blog" });
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const zh = getDict(await getLocale());
  const { q } = await searchParams;
  const posts = q
    ? await prisma.blogPost.findMany({
        where: {
          published: true,
          OR: [{ title: { contains: q } }, { summary: { contains: q } }, { content: { contains: q } }],
        },
        orderBy: { createdAt: "desc" },
      })
    : await getPublishedPosts();

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
          {zh.common.search}{zh.common.colon}{q} · {posts.length}
        </p>
      )}
      {!posts.length && <EmptyState title={zh.blog.empty} href={q ? "/blog" : undefined} action={q ? zh.shop.backBlog : undefined} />}
      {posts.length > 0 && (
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
      )}
    </div>
  );
}
