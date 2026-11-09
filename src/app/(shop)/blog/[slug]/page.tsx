import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({ where: { slug, published: true } });
  if (!post) notFound();
  return (
    <article className="card" style={{ padding: "1.75rem", maxWidth: 760 }}>
      <h1 className="page-title">{post.title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {post.authorName} · {post.createdAt.toISOString().slice(0, 10)}
      </p>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>{post.content}</div>
    </article>
  );
}
