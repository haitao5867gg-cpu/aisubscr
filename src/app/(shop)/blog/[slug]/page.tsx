import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({ where: { slug, published: true } });
  const t = getDict(await getLocale());
  return pageMeta({
    title: post?.title || t.seo.blogTitle,
    description: post?.summary || t.seo.blogDescription,
    path: `/blog/${slug}`,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const zh = getDict(await getLocale());
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({ where: { slug, published: true } });
  if (!post) notFound();
  return (
    <article className="reading stack">
      <Link href="/blog" className="muted">
        ← {zh.shop.backBlog}
      </Link>
      <h1 className="page-title">{post.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {post.authorName} · {post.createdAt.toISOString().slice(0, 10)}
      </p>
      <div className="card" style={{ padding: "1.4rem 1.5rem", whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
        {post.content}
      </div>
    </article>
  );
}
