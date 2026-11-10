import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import type { BlogPost, FaqEntry, Product, SiteSetting } from "@prisma/client";
import { catalogOrderBy } from "./catalog";
import { prisma } from "./db";

export type PublicTag = "catalog" | "help" | "blog" | "settings";

/** Drop the public cache after an admin write. Unit tests have no Next cache store. */
export function refreshPublic(tag: PublicTag) {
  try {
    revalidateTag(tag);
  } catch (error) {
    if (process.env.VITEST) return;
    throw error;
  }
}

export function reviveTimestamp(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function reviveDates<T extends { createdAt?: Date | string; updatedAt?: Date | string }>(row: T): T {
  const next = { ...row };
  if (next.createdAt != null) next.createdAt = reviveTimestamp(next.createdAt);
  if (next.updatedAt != null) next.updatedAt = reviveTimestamp(next.updatedAt);
  return next;
}

const settingSelect = {
  id: true,
  siteName: true,
  supportEmail: true,
  supportHours: true,
  footerText: true,
  wechatId: true,
  qq: true,
  contactEmail: true,
  qrImageUrl: true,
  announcementText: true,
  announcementEnabled: true,
  orderExpireMinutes: true,
  updatedAt: true,
} as const;

export type PublicSettings = Pick<SiteSetting, keyof typeof settingSelect>;

const loadProducts = unstable_cache(
  async () => prisma.product.findMany({ where: { active: true }, orderBy: catalogOrderBy }),
  ["public-active-products"],
  { revalidate: 60, tags: ["catalog"] },
);

const loadFaq = unstable_cache(
  async () =>
    prisma.faqEntry.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ["public-faq"],
  { revalidate: 300, tags: ["help"] },
);

const loadPosts = unstable_cache(
  async () => prisma.blogPost.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } }),
  ["public-blog"],
  { revalidate: 60, tags: ["blog"] },
);

const loadSettings = unstable_cache(
  async () => prisma.siteSetting.findUnique({ where: { id: "default" }, select: settingSelect }),
  ["public-settings"],
  { revalidate: 60, tags: ["settings"] },
);

export const getActiveProducts = cache(async (): Promise<Product[]> => {
  const rows = await loadProducts();
  return rows.map((row) => reviveDates(row));
});

export const getActiveProduct = cache(async (id: string) => {
  const products = await getActiveProducts();
  return products.find((product) => product.id === id) ?? null;
});

export const getPublishedFaqs = cache(async (): Promise<FaqEntry[]> => {
  const rows = await loadFaq();
  return rows.map((row) => reviveDates(row));
});

export const getPublishedPosts = cache(async (): Promise<BlogPost[]> => {
  const rows = await loadPosts();
  return rows.map((row) => reviveDates(row));
});

export const getPublishedPost = cache(async (slug: string) => {
  const posts = await getPublishedPosts();
  return posts.find((post) => post.slug === slug) ?? null;
});

export const getPublicSettings = cache(async (): Promise<PublicSettings | null> => {
  const row = await loadSettings();
  return row ? reviveDates(row) : null;
});
