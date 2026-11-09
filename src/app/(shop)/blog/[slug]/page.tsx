import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { zh } from "@/i18n/zh";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
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
