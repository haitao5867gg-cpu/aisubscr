/**
 * Visitor address for rate limits.
 *
 * nginx overwrites X-Real-IP with $remote_addr and appends that peer to
 * X-Forwarded-For. The app is only reachable through that proxy (127.0.0.1).
 *
 * - If X-Real-IP is already a visitor address, use it. A client who connects
 *   straight to the origin cannot override it with a spoofed CF-Connecting-IP.
 * - If X-Real-IP is a Cloudflare edge address, real_ip was not applied and the
 *   visitor is CF-Connecting-IP (Cloudflare sets that header).
 * - Otherwise walk X-Forwarded-For from the right, skipping Cloudflare and
 *   loopback/private hops. The client-controlled prefix is on the left.
 *
 * Ranges match deploy/nginx-cloudflare-realip.conf (Cloudflare list, 2026-11-10).
 */

const CLOUDFLARE_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
] as const;

const CLOUDFLARE_V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
] as const;

const LOCAL_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
] as const;

type V4Net = { base: number; mask: number };
type V6Net = { base: bigint; mask: bigint };

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

function ipv4ToInt(ip: string): number | null {
  const octets = ipv4Parts(ip);
  if (!octets) return null;
  return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
}

function v4Mask(bits: number): number {
  if (bits <= 0) return 0;
  if (bits >= 32) return 0xffffffff;
  return (0xffffffff << (32 - bits)) >>> 0;
}

function parseV4Net(cidr: string): V4Net {
  const [base, bits] = cidr.split("/");
  const parsed = ipv4ToInt(base);
  if (parsed === null) throw new Error(`bad cidr ${cidr}`);
  return { base: parsed, mask: v4Mask(Number(bits)) };
}

function inV4(ip: number, net: V4Net): boolean {
  return (ip & net.mask) === (net.base & net.mask);
}

/** Turn a trailing dotted IPv4 (as in ::ffff:192.0.2.1) into two hex groups. */
function expandIpv4Tail(ip: string): string | null {
  if (!ip.includes(".")) return ip;
  const match = ip.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (!match) return null;
  const v4 = ipv4Parts(match[2]);
  if (!v4) return null;
  const hi = (v4[0] << 8) | v4[1];
  const lo = (v4[2] << 8) | v4[3];
  return `${match[1]}${hi.toString(16)}:${lo.toString(16)}`;
}

function ipv6Groups(ip: string): number[] | null {
  const value = ip.toLowerCase();
  if (value.includes("%") || value.includes(".")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  const groups = [...head, ...Array(missing).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const parsed: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    parsed.push(parseInt(group, 16));
  }
  return parsed;
}

function groupsToBigInt(groups: number[]): bigint {
  return groups.reduce((acc, group) => (acc << BigInt(16)) + BigInt(group), BigInt(0));
}

function v6Mask(bits: number): bigint {
  if (bits <= 0) return BigInt(0);
  if (bits >= 128) return (BigInt(1) << BigInt(128)) - BigInt(1);
  return ((BigInt(1) << BigInt(bits)) - BigInt(1)) << BigInt(128 - bits);
}

function parseV6Net(cidr: string): V6Net {
  const slash = cidr.lastIndexOf("/");
  const groups = ipv6Groups(cidr.slice(0, slash));
  if (!groups) throw new Error(`bad cidr ${cidr}`);
  return { base: groupsToBigInt(groups), mask: v6Mask(Number(cidr.slice(slash + 1))) };
}

const CLOUDFLARE_V4_NETS = CLOUDFLARE_V4.map(parseV4Net);
const LOCAL_V4_NETS = LOCAL_V4.map(parseV4Net);
const CLOUDFLARE_V6_NETS = CLOUDFLARE_V6.map(parseV6Net);
const LOCAL_V6_NETS: V6Net[] = [
  { base: BigInt(1), mask: (BigInt(1) << BigInt(128)) - BigInt(1) }, // ::1
  { base: BigInt(0xfc00) << BigInt(112), mask: v6Mask(7) }, // fc00::/7
  { base: BigInt(0xfe80) << BigInt(112), mask: v6Mask(10) }, // fe80::/10
];

type CanonicalIp = { kind: "v4"; value: number; text: string } | { kind: "v6"; value: bigint; text: string };

function canonicalIp(raw: string): CanonicalIp | null {
  const v4 = ipv4Parts(raw);
  if (v4) {
    const text = v4.join(".");
    return { kind: "v4", value: ipv4ToInt(text)!, text };
  }
  const expanded = expandIpv4Tail(raw);
  if (!expanded) return null;
  const groups = ipv6Groups(expanded);
  if (!groups) return null;
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff) {
    const text = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return { kind: "v4", value: ipv4ToInt(text)!, text };
  }
  const text = groups.map((group) => group.toString(16)).join(":");
  return { kind: "v6", value: groupsToBigInt(groups), text };
}

function isCloudflare(ip: CanonicalIp): boolean {
  if (ip.kind === "v4") return CLOUDFLARE_V4_NETS.some((net) => inV4(ip.value, net));
  return CLOUDFLARE_V6_NETS.some((net) => (ip.value & net.mask) === (net.base & net.mask));
}

function isLocalProxy(ip: CanonicalIp): boolean {
  if (ip.kind === "v4") return LOCAL_V4_NETS.some((net) => inV4(ip.value, net));
  return LOCAL_V6_NETS.some((net) => (ip.value & net.mask) === (net.base & net.mask));
}

function readIp(header: string | null): CanonicalIp | null {
  if (!header) return null;
  const value = header.trim();
  if (!value || value.length > 64 || /[\s,]/.test(value)) return null;
  return canonicalIp(value);
}

export function clientIp(headers: Headers): string {
  const real = readIp(headers.get("x-real-ip"));
  const cf = readIp(headers.get("cf-connecting-ip"));

  if (real && isCloudflare(real) && cf && !isCloudflare(cf) && !isLocalProxy(cf)) {
    return cf.text;
  }
  if (real && !isCloudflare(real) && !isLocalProxy(real)) return real.text;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => readIp(part))
      .filter((ip): ip is CanonicalIp => ip !== null);
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i];
      if (isCloudflare(hop) || isLocalProxy(hop)) continue;
      return hop.text;
    }
  }

  if (cf && !isCloudflare(cf) && !isLocalProxy(cf)) return cf.text;
  if (real && !isLocalProxy(real)) return real.text;
  return "unknown";
}
