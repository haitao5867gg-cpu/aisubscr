import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readR2Config, type R2Config } from "./r2-config";

const KEY = /^(products|contact-qr|tickets)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function uploadsRoot() {
  return path.join(process.cwd(), "public", "uploads");
}

export function assertStorageKey(key: string) {
  if (!KEY.test(key)) throw new Error("bad storage key");
}

export type ObjectPut = (cfg: R2Config, key: string, body: Buffer) => Promise<void>;

async function writeLocal(key: string, body: Buffer) {
  assertStorageKey(key);
  const root = path.resolve(uploadsRoot());
  const dest = path.resolve(root, key);
  if (!dest.startsWith(`${root}${path.sep}`)) throw new Error("bad storage key");
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
}

/** S3-compatible PutObject against Cloudflare R2. */
export async function putToR2(cfg: R2Config, key: string, body: Buffer) {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/**
 * Store a WebP that is already validated. Uses R2 when every R2 variable is set,
 * and public/uploads otherwise. The returned URL is what product and contact pages render.
 */
export async function storePublicWebp(key: string, body: Buffer, put: ObjectPut = putToR2) {
  assertStorageKey(key);
  const cfg = readR2Config();
  if (!cfg) {
    await writeLocal(key, body);
    return `/uploads/${key}`;
  }
  await put(cfg, key, body);
  return `${cfg.publicBaseUrl}/${key}`;
}
