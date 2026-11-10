import type { Metadata } from "next";

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
