import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SEC = 30;
const DIGITS = 6;
const WINDOW = 1;
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const DEV_SECRET = "aisubscr-dev-session-secret-change-in-production-32chars";

function pepper() {
  const configured = process.env.SESSION_SECRET?.trim() ?? "";
  return configured.length >= 32 ? configured : DEV_SECRET;
}

function aesKey() {
  return createHash("sha256").update(`${pepper()}:aisubscr-totp-v1`).digest();
}

/** AES-256-GCM. Rotating SESSION_SECRET invalidates stored secrets; recovery codes stay usable. */
export function encryptTotpSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptTotpSecret(payload: string) {
  try {
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 4226 HOTP, SHA-1, used by RFC 6238 TOTP. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpCounter(at = Date.now()) {
  return Math.floor(at / 1000 / PERIOD_SEC);
}

export function totpCode(secret: string, at = Date.now()) {
  return hotp(base32Decode(secret), totpCounter(at));
}

/**
 * Accept the current 30s step and one step on either side.
 * Every candidate is compared so the match position is not leaked by timing.
 */
export function matchTotpStep(secret: string, token: string, at = Date.now()) {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return null;
  const key = base32Decode(secret);
  if (key.length < 10) return null;
  const counter = totpCounter(at);
  const presented = Buffer.from(cleaned);
  let matched: number | null = null;
  for (let delta = -WINDOW; delta <= WINDOW; delta += 1) {
    const step = counter + delta;
    const expected = Buffer.from(hotp(key, step));
    if (expected.length === presented.length && timingSafeEqual(expected, presented)) matched = step;
  }
  return matched;
}

/** Key URI that Google Authenticator and other SHA-1 / 6-digit / 30s apps scan. */
export function otpauthUrl(email: string, secret: string) {
  const label = `aisubscr:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer: "aisubscr",
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SEC),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

/** Ten one-time codes, shown as xxxx-xxxx. The alphabet avoids look-alike characters. */
export function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    let raw = "";
    for (let i = 0; i < 8; i += 1) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isRecoveryCodeShape(code: string) {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== 8) return false;
  return [...normalized].every((char) => RECOVERY_ALPHABET.includes(char));
}
