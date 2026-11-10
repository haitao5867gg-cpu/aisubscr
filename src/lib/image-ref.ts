import { r2PublicBaseUrl } from "./r2-config";

/** Same-site path. Remote URLs are allowed only under the configured R2 public base. */
export function isAllowedImageReference(value: string) {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("..") && !value.includes("\\")) {
    return true;
  }
  const base = r2PublicBaseUrl();
  if (!base) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const prefix = `${base}/`;
  return value.startsWith(prefix);
}
