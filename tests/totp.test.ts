import { describe, expect, it } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  isRecoveryCodeShape,
  matchTotpStep,
  otpauthUrl,
  totpCode,
} from "@/lib/totp";

describe("TOTP", () => {
  it("round-trips a secret and accepts the current step plus one neighbour", () => {
    const secret = generateTotpSecret();
    const hidden = encryptTotpSecret(secret);
    expect(hidden).not.toContain(secret);
    expect(decryptTotpSecret(hidden)).toBe(secret);

    const now = Date.now();
    expect(matchTotpStep(secret, totpCode(secret, now), now)).toBeTypeOf("number");
    expect(matchTotpStep(secret, totpCode(secret, now - 30_000), now)).toBeTypeOf("number");
    expect(matchTotpStep(secret, totpCode(secret, now + 30_000), now)).toBeTypeOf("number");
    expect(matchTotpStep(secret, totpCode(secret, now + 90_000), now)).toBeNull();
    expect(matchTotpStep(secret, "000000", now)).toBeNull();
  });

  it("builds an otpauth URI that authenticator apps can scan", () => {
    const url = otpauthUrl("admin@example.com", "JBSWY3DPEHPK3PXP");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("algorithm=SHA1");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
    expect(url).toContain("issuer=aisubscr");
  });

  it("issues 10 recovery codes with an unambiguous alphabet", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
      expect(isRecoveryCodeShape(code)).toBe(true);
      expect(code).not.toMatch(/[01oil]/);
    }
    expect(isRecoveryCodeShape("not a code")).toBe(false);
  });
});
