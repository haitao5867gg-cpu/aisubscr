/** Visitor address for rate limits.
 * nginx overwrites X-Real-IP, so that header wins over client-supplied forwarding headers.
 * Behind Cloudflare, install deploy/nginx-cloudflare-realip.conf so X-Real-IP is the visitor.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0];
  const candidates = [headers.get("x-real-ip"), headers.get("cf-connecting-ip"), forwarded];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value.slice(0, 64);
  }
  return "unknown";
}
