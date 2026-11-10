import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(bytes: Buffer): ImageMime | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function normalizeDeclared(type: string) {
  const value = type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  if (value === "image/png" || value === "image/jpeg" || value === "image/webp") return value;
  return "";
}

/** Declared type and sniffed bytes must agree. Size is capped at 5 MB. */
export function validateUpload(bytes: Buffer, declared: string): ImageMime | null {
  if (bytes.length < 16 || bytes.length > MAX_UPLOAD_BYTES) return null;
  const sniffed = sniffImage(bytes);
  const claimed = normalizeDeclared(declared);
  if (!sniffed || !claimed || claimed !== sniffed) return null;
  return sniffed;
}

export async function toWebp(bytes: Buffer, purpose: "product" | "contact-qr") {
  const maxEdge = purpose === "contact-qr" ? 800 : 1600;
  return sharp(bytes, { failOn: "error", limitInputPixels: 20_000_000, animated: false })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
