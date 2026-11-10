import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const [products, posts] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { id: true, updatedAt: true } }),
    prisma.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const now = new Date();
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${origin}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/register`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/forgot-password`, changeFrequency: "yearly", priority: 0.2 },
    ...products.map((product) => ({
      url: `${origin}/products/${product.id}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...posts.map((post) => ({
      url: `${origin}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
