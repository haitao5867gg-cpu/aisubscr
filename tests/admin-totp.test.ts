import { beforeEach, describe, expect, it } from "vitest";
import { POST as confirmTotp } from "@/app/api/admin/totp/confirm/route";
import { POST as disableTotp } from "@/app/api/admin/totp/disable/route";
import { POST as setupTotp } from "@/app/api/admin/totp/setup/route";
import { GET as listProducts } from "@/app/api/admin/products/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { consumeSecondFactor } from "@/lib/admin-totp";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totpCode } from "@/lib/totp";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

async function admin(email: string) {
  await prisma.user.create({
    data: { email, passwordHash: await hashPassword("secret12"), role: "ADMIN", name: "管理员" },
  });
}

describe("admin TOTP", () => {
  it("requires a code after enrollment, accepts a recovery code once, and audits both ends", async () => {
    const ip = nextIp();
    const email = `totp-${Date.now()}@example.com`;
    await admin(email);
    expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);

    const started = await setupTotp();
    expect(started.status).toBe(200);
    const { secret } = await started.json();
    expect(typeof secret).toBe("string");

    const confirmed = await confirmTotp(jsonRequest("/api/admin/totp/confirm", { ip, body: { code: totpCode(secret) } }));
    expect(confirmed.status).toBe(200);
    const { recoveryCodes } = await confirmed.json();
    expect(recoveryCodes).toHaveLength(10);
    expect(await prisma.auditLog.findFirst({ where: { action: "totp.enable", actorEmail: email } })).toBeTruthy();
    const stored = await prisma.totpRecoveryCode.findMany({ where: { user: { email } } });
    expect(stored).toHaveLength(10);
    expect(JSON.stringify(stored)).not.toContain(recoveryCodes[0].replace("-", ""));

    resetCookieJar();
    const challenge = await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }));
    expect(challenge.status).toBe(401);
    expect((await challenge.json()).totpRequired).toBe(true);
    expect((await (await me()).json()).user).toBeNull();

    const again = await login(
      jsonRequest("/api/auth/login", {
        ip,
        body: { email, password: "secret12", totp: totpCode(secret, Date.now() + 30_000) },
      }),
    );
    expect(again.status).toBe(200);
    resetCookieJar();

    const reused = await login(
      jsonRequest("/api/auth/login", {
        ip,
        body: { email, password: "secret12", totp: totpCode(secret, Date.now() + 30_000) },
      }),
    );
    expect(reused.status).toBe(401);

    const recovered = await login(
      jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12", totp: recoveryCodes[0] } }),
    );
    expect(recovered.status).toBe(200);
    resetCookieJar();
    const spent = await login(
      jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12", totp: recoveryCodes[0] } }),
    );
    expect(spent.status).toBe(401);

    expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12", totp: recoveryCodes[1] } }))).status).toBe(200);
    const disabled = await disableTotp(
      jsonRequest("/api/admin/totp/disable", { ip, body: { password: "secret12", code: recoveryCodes[2] } }),
    );
    expect(disabled.status).toBe(200);
    expect(await prisma.auditLog.findFirst({ where: { action: "totp.disable", actorEmail: email } })).toBeTruthy();
    expect(await prisma.user.findUnique({ where: { email }, select: { totpEnabled: true } })).toEqual({ totpEnabled: false });

    resetCookieJar();
    expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  });

  it("rate-limits wrong authenticator codes without counting them as password failures", async () => {
    const ip = nextIp();
    const email = `totp-limit-${Date.now()}@example.com`;
    await admin(email);
    expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
    const { secret } = await (await setupTotp()).json();
    expect((await confirmTotp(jsonRequest("/api/admin/totp/confirm", { ip, body: { code: totpCode(secret) } }))).status).toBe(200);
    resetCookieJar();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12", totp: "000000" } }));
      expect(res.status, `attempt ${attempt}`).toBe(401);
    }
    const locked = await login(
      jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12", totp: totpCode(secret, Date.now() + 30_000) } }),
    );
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBeTruthy();
  });

  it("blocks other admin APIs until enrollment when 2FA is mandatory", async () => {
    const ip = nextIp();
    const email = `totp-required-${Date.now()}@example.com`;
    await admin(email);
    try {
      await prisma.siteSetting.upsert({
        where: { id: "default" },
        update: { adminTotpRequired: true },
        create: { id: "default", adminTotpRequired: true },
      });
      expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
      const blocked = await listProducts();
      expect(blocked.status).toBe(403);
      expect((await blocked.json()).code).toBe("TOTP_ENROLLMENT_REQUIRED");
      expect((await setupTotp()).status).toBe(200);
    } finally {
      await prisma.siteSetting.updateMany({ where: { id: "default" }, data: { adminTotpRequired: false } });
    }
  });

  it("rejects a repeated authenticator step", async () => {
    const email = `totp-replay-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword("secret12"), role: "ADMIN" },
    });
    expect((await login(jsonRequest("/api/auth/login", { ip: nextIp(), body: { email, password: "secret12" } }))).status).toBe(200);
    const { secret } = await (await setupTotp()).json();
    const code = totpCode(secret);
    expect((await confirmTotp(jsonRequest("/api/admin/totp/confirm", { ip: nextIp(), body: { code } }))).status).toBe(200);
    expect(await consumeSecondFactor(user.id, code)).toBe(false);
  });
});
