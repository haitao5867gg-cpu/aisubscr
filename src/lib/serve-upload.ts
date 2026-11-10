import { createReadStream, type ReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { uploadsRoot } from "./object-storage";

/**
 * Product and QR uploads are stored as `<folder>/<uuid>.webp`.
 * `randomUUID()` makes each URL unique, and the file is not replaced later.
 * That is a unique name, not a content hash, and it is enough for a year-long
 * immutable cache. Ticket screenshots use a private cache on the authenticated route.
 */
export const UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const TICKET_CACHE_CONTROL = "private, no-store";

const CONTENT_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MAX_SEGMENTS = 8;
const MAX_SEGMENT_LENGTH = 200;

export function contentTypeForUpload(filename: string): string | null {
  if (!filename || /[/\\\u0000]/.test(filename)) return null;
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? null;
}

function decodeSegment(raw: string): string | null {
  if (!raw.includes("%")) return raw;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.includes("%")) return null;
  return decoded;
}

/**
 * URL pieces under `/uploads/`. Rejects `..`, absolute paths, encoded
 * separators, and anything that is not an allowed image name.
 * Returns a relative path using `/`, or null.
 */
export function relativeUploadPath(segments: readonly string[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > MAX_SEGMENTS) return null;
  const clean: string[] = [];
  for (const raw of segments) {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_SEGMENT_LENGTH) return null;
    const segment = decodeSegment(raw);
    if (segment === null || segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH) return null;
    if (/[\u0000-\u001f\u007f]/.test(segment)) return null;
    if (segment.includes("/") || segment.includes("\\") || segment.includes("%")) return null;
    // "." / ".." and dotfiles such as .secret.webp
    if (segment.startsWith(".")) return null;
    clean.push(segment);
  }
  if (!contentTypeForUpload(clean[clean.length - 1] ?? "")) return null;
  const relative = clean.join("/");
  const anchor = path.resolve(tmpdir(), "aisubscr-upload-anchor");
  const resolved = path.resolve(anchor, relative);
  if (!resolved.startsWith(`${anchor}${path.sep}`)) return null;
  return relative;
}

export type OpenedUpload = {
  contentType: string;
  size: number;
  stream: ReadStream;
};

/**
 * Open one image inside the uploads directory, or null if the URL is not safe.
 * Public callers cannot read `tickets/`: those files are screenshots and are
 * served only after an ownership or admin check.
 */
export async function openUpload(
  segments: readonly string[],
  options?: { audience?: "public" | "ticket" },
): Promise<OpenedUpload | null> {
  const relative = relativeUploadPath(segments);
  if (!relative) return null;
  const ticket = relative.startsWith("tickets/");
  const audience = options?.audience ?? "public";
  if (audience === "public" && ticket) return null;
  if (audience === "ticket" && !ticket) return null;
  const root = uploadsRoot();
  if (root === path.parse(root).root) return null;
  let rootReal: string;
  try {
    rootReal = await realpath(root);
  } catch {
    return null;
  }
  const rootInfo = await stat(rootReal);
  if (!rootInfo.isDirectory()) return null;
  const prefix = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  const candidate = path.resolve(rootReal, relative);
  if (!candidate.startsWith(prefix)) return null;
  let fileReal: string;
  try {
    fileReal = await realpath(candidate);
  } catch {
    return null;
  }
  if (!fileReal.startsWith(prefix)) return null;
  const info = await stat(fileReal);
  if (!info.isFile()) return null;
  const contentType = contentTypeForUpload(path.basename(candidate));
  if (!contentType) return null;
  return { contentType, size: info.size, stream: createReadStream(fileReal) };
}
