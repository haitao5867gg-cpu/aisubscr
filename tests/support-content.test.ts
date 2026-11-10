import { beforeEach, expect, it } from "vitest";
import { GET as publicSettings } from "@/app/api/settings/route";
import { PATCH as saveSettings } from "@/app/api/admin/settings/route";
import { GET as listFaq, POST as createFaq } from "@/app/api/admin/faq/route";
import { POST as login } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decodeQrImage } from "@/lib/site-settings";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]).toString("base64");

it("rejects a file that is not a real image and accepts a small PNG", () => {
  expect(decodeQrImage("image/png", Buffer.from("not-an-image-padding").toString("base64"))).toBeNull();
  expect(decodeQrImage("image/png", png)?.mime).toBe("image/png");
  expect(decodeQrImage("text/html", png)).toBeNull();
});

it("keeps FAQ and settings changes behind admin, and hides QR bytes from the public settings", async () => {
  const ip = nextIp();
  expect((await listFaq()).status).toBe(401);

  const member = `member-${Date.now()}@example.com`;
  await prisma.user.create({ data: { email: member, passwordHash: await hashPassword("secret12") } });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: member, password: "secret12" } }))).status).toBe(200);
  expect((await listFaq()).status).toBe(403);
  expect((await createFaq(jsonRequest("/api/admin/faq", { ip, body: { question: "不能写", answer: "不能写" } }))).status).toBe(403);

  const admin = `admin-faq-${Date.now()}@example.com`;
  await prisma.user.create({
    data: { email: admin, passwordHash: await hashPassword("secret12"), role: "ADMIN", name: "管理员" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: admin, password: "secret12" } }))).status).toBe(200);
  const created = await createFaq(
    jsonRequest("/api/admin/faq", { ip, body: { question: "如何联系客服？", answer: "打开联系页面。", sortOrder: 1, published: true } }),
  );
  expect(created.status).toBe(200);
  const { entry } = await created.json();
  expect(await prisma.auditLog.findFirst({ where: { action: "faq.create", targetId: entry.id } })).toBeTruthy();

  const saved = await saveSettings(
    jsonRequest("/api/admin/settings", {
      ip,
      method: "PATCH",
      body: {
        announcementText: "今晚维护",
        announcementEnabled: true,
        wechatId: "demo-wechat",
        qq: "800",
        orderExpireMinutes: 45,
        qrImageMime: "image/png",
        qrImageBase64: png,
      },
    }),
  );
  expect(saved.status).toBe(200);
  const adminBody = await saved.json();
  expect(adminBody.settings).toMatchObject({
    announcementText: "今晚维护",
    announcementEnabled: true,
    wechatId: "demo-wechat",
    hasContactQr: true,
    orderExpireMinutes: 45,
  });
  expect(JSON.stringify(adminBody)).not.toContain(png);

  const pub = await publicSettings();
  const publicBody = await pub.json();
  expect(publicBody.settings.hasContactQr).toBe(true);
  expect(publicBody.settings.qrImageData).toBeUndefined();
  expect(JSON.stringify(publicBody)).not.toContain(png);
});
