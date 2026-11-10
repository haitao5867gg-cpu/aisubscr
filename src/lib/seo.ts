import type { Metadata } from "next";

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(input: { name: string; url: string; email?: string; logo?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.email ? { email: input.email } : {}),
    ...(input.logo ? { logo: input.logo } : {}),
  };
}

export function productJsonLd(input: {
  name: string;
  description: string;
  sku: string;
  priceCents: number;
  url: string;
  image?: string | null;
  inStock: boolean;
  brand: string;
}) {
  const image = absoluteAsset(input.image, input.url);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    sku: input.sku,
    brand: { "@type": "Brand", name: input.brand },
    ...(image ? { image } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "CNY",
      price: (input.priceCents / 100).toFixed(2),
      availability: input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: input.url,
    },
  };
}

function absoluteAsset(image: string | null | undefined, pageUrl: string) {
  if (!image) return undefined;
  if (image.startsWith("https://") || image.startsWith("http://")) return image;
  if (!image.startsWith("/")) return undefined;
  return `${new URL(pageUrl).origin}${image}`;
}

export function pageMeta(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const index = opts.index !== false;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.path,
      type: "website",
    },
  };
}
