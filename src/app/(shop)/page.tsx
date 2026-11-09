import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRmb } from "@/lib/money";
import { zh } from "@/i18n/zh";
import { ArticleSearch } from "@/components/ArticleSearch";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    take: 6,
    orderBy: { createdAt: "asc" },
  });
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    take: 6,
    orderBy: { createdAt: "desc" },
  });
  const productCount = await prisma.product.count({ where: { active: true } });
  const postCount = await prisma.blogPost.count({ where: { published: true } });
  const subCount = await prisma.product.count({ where: { active: true, isSubscription: true } });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <section className="hero">
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <span className="badge badge-completed">
            <span className="live-dot" /> 示例站点 · 本地预览
          </span>
          <span className="badge badge-mock">{zh.common.mockPay}</span>
          <span className="badge badge-example">{zh.common.exampleData}</span>
        </div>
        <h1 className="page-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          {zh.home.headline}
        </h1>
        <p className="text-secondary" style={{ maxWidth: "40rem", marginTop: 0 }}>
          {zh.home.description}
        </p>
        <div className="row" style={{ marginBottom: "1.25rem" }}>
          <Link href="/products" className="btn btn-primary">
            {zh.home.ctaProducts} →
          </Link>
          <Link href="/blog" className="btn btn-secondary">
            {zh.home.ctaBlog}
          </Link>
        </div>
        <ArticleSearch />
        <div className="row" style={{ marginTop: "1.25rem" }}>
          <div className="card" style={{ padding: "0.85rem 1rem", background: "var(--success-soft)", borderColor: "transparent" }}>
            <div className="muted" style={{ fontSize: "0.8rem" }}>文章</div>
            <strong style={{ fontSize: "1.35rem", color: "var(--success)" }}>{postCount}</strong>
          </div>
          <div className="card" style={{ padding: "0.85rem 1rem", background: "var(--primary-tint)", borderColor: "transparent" }}>
            <div className="muted" style={{ fontSize: "0.8rem" }}>商品</div>
            <strong style={{ fontSize: "1.35rem", color: "var(--primary)" }}>{productCount}</strong>
          </div>
          <div className="card" style={{ padding: "0.85rem 1rem" }}>
            <div className="muted" style={{ fontSize: "0.8rem" }}>可续费</div>
            <strong style={{ fontSize: "1.35rem" }}>{subCount}</strong>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: "1.25rem" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.85rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
            {zh.home.highlightsUpdated}（更新于 {today}）
          </h2>
          <Link href="/blog" className="muted">
            更多 →
          </Link>
        </div>
        <div className="stack" style={{ gap: "0.85rem" }}>
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} style={{ display: "grid", gridTemplateColumns: "6.5rem 1fr", gap: "0.75rem" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {post.createdAt.toISOString().slice(0, 10)}
              </span>
              <span>
                <strong style={{ color: "var(--primary)" }}>{post.title}</strong>
                <div className="muted" style={{ fontSize: "0.9rem" }}>
                  {post.summary}
                </div>
              </span>
            </Link>
          ))}
          {!posts.length && <p className="muted">{zh.blog.empty}</p>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>{zh.blog.categories}</h2>
        <div className="row">
          <Link href="/blog" className="chip active">
            全部文章 <span className="badge badge-example">{postCount}</span>
          </Link>
          <Link href="/products" className="chip">
            商品订阅 <span className="badge badge-example">{productCount}</span>
          </Link>
          <Link href="/products" className="chip">
            可续费 <span className="badge badge-example">{subCount}</span>
          </Link>
          <Link href="/blog/how-to-order" className="chip">
            下单指南
          </Link>
        </div>
      </section>

      <section>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{zh.product.listTitle}</h2>
          <Link href="/products" className="muted">
            查看全部 →
          </Link>
        </div>
        <div className="grid-products">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} className="card" style={{ padding: "1.25rem", display: "block" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{p.name}</strong>
                <span className="badge badge-example">示例</span>
              </div>
              <p className="muted" style={{ fontSize: "0.9rem", minHeight: "3.2em" }}>
                {p.description.slice(0, 72)}…
              </p>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong style={{ color: "var(--primary)", fontSize: "1.15rem" }}>{formatRmb(p.priceCents)}</strong>
                {p.isSubscription && <span className="badge badge-mock">{zh.product.subscription}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
