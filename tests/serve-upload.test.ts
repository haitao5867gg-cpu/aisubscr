import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as readUpload } from "@/app/api/uploads/file/[...path]/route";
import { storePublicWebp } from "@/lib/object-storage";
import { UPLOAD_CACHE_CONTROL, contentTypeForUpload, openUpload, relativeUploadPath } from "@/lib/serve-upload";

const previousUploads = process.env.UPLOADS_DIR;
const dirs: string[] = [];

afterEach(async () => {
  if (previousUploads === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previousUploads;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "aisubscr-uploads-"));
  dirs.push(dir);
  return dir;
}

describe("upload paths", () => {
  it("rejects path traversal and non-images", () => {
    expect(relativeUploadPath(["products", "..", "..", "etc", "passwd.webp"])).toBeNull();
    expect(relativeUploadPath(["..", "secret.webp"])).toBeNull();
    expect(relativeUploadPath(["products", "..", "secret.webp"])).toBeNull();
    expect(relativeUploadPath([".", "a.webp"])).toBeNull();
    expect(relativeUploadPath(["/etc/passwd.webp"])).toBeNull();
    expect(relativeUploadPath(["products\\..\\..\\win.webp"])).toBeNull();
    expect(relativeUploadPath(["products", "a.webp\u0000.png"])).toBeNull();
    expect(relativeUploadPath(["%2e%2e", "secret.webp"])).toBeNull();
    expect(relativeUploadPath(["%2e%2e%2f%2e%2e%2fetc%2fpasswd.webp"])).toBeNull();
    expect(relativeUploadPath(["products", "%2e%2e"])).toBeNull();
    expect(relativeUploadPath(["products", "..%2F..%2Fpackage.json"])).toBeNull();
    expect(relativeUploadPath(["%252e%252e", "secret.webp"])).toBeNull();
    expect(relativeUploadPath([])).toBeNull();
    expect(relativeUploadPath(["products", ""])).toBeNull();
    expect(relativeUploadPath(["products", "note.txt"])).toBeNull();
    expect(relativeUploadPath(["products", "page.html"])).toBeNull();
    expect(relativeUploadPath(["products", "icon.svg"])).toBeNull();
    expect(relativeUploadPath([".env"])).toBeNull();
    expect(relativeUploadPath([".secret.webp"])).toBeNull();
    expect(relativeUploadPath(["products", "ok.webp"])).toBe("products/ok.webp");
    expect(relativeUploadPath(["contact-qr", "ok.webp"])).toBe("contact-qr/ok.webp");
  });

  it("maps only image extensions to content types", () => {
    expect(contentTypeForUpload("a.webp")).toBe("image/webp");
    expect(contentTypeForUpload("a.WEBP")).toBe("image/webp");
    expect(contentTypeForUpload("a.png")).toBe("image/png");
    expect(contentTypeForUpload("a.jpg")).toBe("image/jpeg");
    expect(contentTypeForUpload("a.jpeg")).toBe("image/jpeg");
    expect(contentTypeForUpload("a.JPEG")).toBe("image/jpeg");
    expect(contentTypeForUpload("a.gif")).toBe("image/gif");
    expect(contentTypeForUpload("a.webp.png")).toBe("image/png");
    expect(contentTypeForUpload("a.png.webp")).toBe("image/webp");
    expect(contentTypeForUpload("a.txt")).toBeNull();
    expect(contentTypeForUpload("a.html")).toBeNull();
    expect(contentTypeForUpload("a.svg")).toBeNull();
    expect(contentTypeForUpload("a.webp.html")).toBeNull();
    expect(contentTypeForUpload("a.js")).toBeNull();
    expect(contentTypeForUpload(".webp")).toBeNull();
    expect(contentTypeForUpload("webp")).toBeNull();
    expect(UPLOAD_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
  });

  it("does not follow a symlink outside the uploads directory", async () => {
    const root = await tempDir();
    const outside = await tempDir();
    process.env.UPLOADS_DIR = root;
    await writeFile(path.join(outside, "secret.webp"), Buffer.from("secret"));
    await symlink(path.join(outside, "secret.webp"), path.join(root, "link.webp"));
    await mkdir(path.join(outside, "nested"));
    await writeFile(path.join(outside, "nested", "a.webp"), Buffer.from("nested"));
    await symlink(path.join(outside, "nested"), path.join(root, "alias"));
    expect(await openUpload(["link.webp"])).toBeNull();
    expect(await openUpload(["alias", "a.webp"])).toBeNull();
    expect(await openUpload(["..", "secret.webp"])).toBeNull();

    const bytes = Buffer.from("RIFFxxxxWEBP");
    await mkdir(path.join(root, "products"));
    await writeFile(path.join(root, "products", "ok.webp"), bytes);
    const opened = await openUpload(["products", "ok.webp"]);
    expect(opened?.contentType).toBe("image/webp");
    expect(opened?.size).toBe(bytes.length);
    const chunks: Buffer[] = [];
    for await (const chunk of opened!.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(bytes);
  });

  it("reads a file when UPLOADS_DIR itself is a symlink", async () => {
    const real = await tempDir();
    const parent = await tempDir();
    const link = path.join(parent, "uploads");
    await symlink(real, link);
    process.env.UPLOADS_DIR = link;
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(path.join(real, "pixel.png"), bytes);
    const opened = await openUpload(["pixel.png"]);
    expect(opened?.contentType).toBe("image/png");
    opened?.stream.destroy();
  });

  it("streams from UPLOADS_DIR with image headers", async () => {
    const root = await tempDir();
    process.env.UPLOADS_DIR = root;
    const key = "products/11111111-1111-4111-8111-111111111111.webp";
    const body = Buffer.from("RIFFxxxxWEBP");
    for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BUCKET", "R2_PUBLIC_BASE_URL"]) {
      delete process.env[name];
    }
    expect(await storePublicWebp(key, body)).toBe(`/uploads/${key}`);

    const response = await readUpload(new NextRequest("http://127.0.0.1/uploads/products/x.webp"), {
      params: Promise.resolve({ path: ["products", "11111111-1111-4111-8111-111111111111.webp"] }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe(UPLOAD_CACHE_CONTROL);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(body);

    const escaped = await readUpload(new NextRequest("http://127.0.0.1/uploads/etc/passwd"), {
      params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
    });
    expect(escaped.status).toBe(404);
    expect(escaped.headers.get("cache-control")).toBe("no-store");
    expect(escaped.headers.get("x-content-type-options")).toBe("nosniff");

    const text = await readUpload(new NextRequest("http://127.0.0.1/uploads/products/note.txt"), {
      params: Promise.resolve({ path: ["products", "note.txt"] }),
    });
    expect(text.status).toBe(404);
  });
});
