import { rm } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { POST as upload } from "@/app/api/admin/uploads/route";
import { PATCH as saveSettings } from "@/app/api/admin/settings/route";
import { POST as login } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES, sniffImage, validateUpload } from "@/lib/image-upload";
import { isAllowedImageReference } from "@/lib/image-ref";
import { storePublicWebp } from "@/lib/object-storage";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

beforeEach(() => {
  resetCookieJar();
});

afterAll(async () => {
  await rm("public/uploads/products", { recursive: true, force: true });
  await rm("public/uploads/contact-qr", { recursive: true, force: true });
});

function formRequest(form: FormData, ip: string) {
  const headers = new Headers();
  headers.set("x-real-ip", ip);
  headers.set("x-request-id", "upload-test-request");
  return new NextRequest("http://127.0.0.1/api/admin/uploads", { method: "POST", headers, body: form });
}

describe("upload validation", () => {
  it("rejects a mismatched type, a non-image, and a file over 5 MB", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    expect(validateUpload(png, "image/png")).toBe("image/png");
    expect(validateUpload(png, "image/jpeg")).toBeNull();
    expect(validateUpload(Buffer.from("not-an-image-at-all!!"), "image/png")).toBeNull();
    expect(validateUpload(Buffer.concat([Buffer.alloc(MAX_UPLOAD_BYTES), Buffer.from([1])]), "image/png")).toBeNull();
    expect(sniffImage(Buffer.from("GIF89a-not-allowed"))).toBeNull();
  });

  it("stores a resized WebP on disk and rejects a fake png", async () => {
    const ip = nextIp();
    const email = `upload-${Date.now()}@example.com`;
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword("secret12"), role: "ADMIN", name: "管理员" },
    });
    expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);

    const wide = await sharp({
      create: { width: 1800, height: 20, channels: 3, background: { r: 200, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set("purpose", "product");
    form.set("file", new File([wide], "wide.png", { type: "image/png" }));
    const saved = await upload(formRequest(form, ip));
    expect(saved.status).toBe(200);
    const { url } = await saved.json();
    expect(url).toMatch(/^\/uploads\/products\/[0-9a-f-]+\.webp$/);
    const meta = await sharp(`public${url}`).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(1600);

    const fake = new FormData();
    fake.set("purpose", "product");
    fake.set("file", new File([Buffer.from("this is not a png file!!")], "note.png", { type: "image/png" }));
    expect((await upload(formRequest(fake, ip))).status).toBe(400);

    const qr = new FormData();
    qr.set("purpose", "contact-qr");
    const jpeg = await sharp({
      create: { width: 900, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    qr.set("file", new File([jpeg], "qr.jpg", { type: "image/jpeg" }));
    const qrSaved = await upload(formRequest(qr, ip));
    expect(qrSaved.status).toBe(200);
    const qrBody = await qrSaved.json();
    const qrMeta = await sharp(`public${qrBody.url}`).metadata();
    expect(qrMeta.width).toBeLessThanOrEqual(800);

    const settings = await saveSettings(
      jsonRequest("/api/admin/settings", { ip, method: "PATCH", body: { qrImageUrl: qrBody.url } }),
    );
    expect(settings.status).toBe(200);
    expect((await settings.json()).settings.qrImageUrl).toBe(qrBody.url);

    const remote = await saveSettings(
      jsonRequest("/api/admin/settings", { ip, method: "PATCH", body: { qrImageUrl: "https://evil.example/a.webp" } }),
    );
    expect(remote.status).toBe(400);
  });

  it("uses R2 only when every variable is set", async () => {
    const key = "products/11111111-1111-4111-8111-111111111111.webp";
    const body = Buffer.from("RIFFxxxxWEBP");
    const previous = Object.fromEntries(R2_KEYS.map((name) => [name, process.env[name]]));
    const calls: string[] = [];
    try {
      delete process.env.R2_ACCOUNT_ID;
      const local = await storePublicWebp(key, body);
      expect(local).toBe(`/uploads/${key}`);

      process.env.R2_ACCOUNT_ID = "account";
      process.env.R2_ACCESS_KEY_ID = "key";
      process.env.R2_SECRET_ACCESS_KEY = "secret";
      process.env.R2_PUBLIC_BUCKET = "shop";
      process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/assets";
      const remote = await storePublicWebp(key, body, async (cfg, objectKey) => {
        calls.push(`${cfg.bucket}:${objectKey}`);
      });
      expect(remote).toBe(`https://cdn.example.com/assets/${key}`);
      expect(calls).toEqual([`shop:${key}`]);
      expect(isAllowedImageReference(remote)).toBe(true);
      expect(isAllowedImageReference("https://cdn.example.com.evil/assets/x.webp")).toBe(false);
      expect(isAllowedImageReference("/uploads/products/a.webp")).toBe(true);
      expect(isAllowedImageReference("//evil.example/a.webp")).toBe(false);
    } finally {
      for (const name of R2_KEYS) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
});
