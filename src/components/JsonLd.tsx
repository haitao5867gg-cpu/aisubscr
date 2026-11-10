import { headers } from "next/headers";
import { jsonLdScript } from "@/lib/seo";

/** Inline JSON-LD. The nonce matches the per-request CSP so strict-dynamic allows the tag. */
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
