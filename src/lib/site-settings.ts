const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const QR_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type QrMime = (typeof QR_MIMES)[number];

export const MAX_QR_BYTES = 512 * 1024;

export type SettingsRow = {
  siteName: string;
  supportEmail: string;
  supportHours: string;
  footerText: string;
  wechatId: string;
  qq: string;
  contactEmail: string;
  qrImageUrl: string | null;
  adminTotpRequired: boolean;
  qrImageMime: string | null;
  qrImageData: string | null;
  announcementText: string;
  announcementEnabled: boolean;
  orderExpireMinutes: number;
  adminNotifyEmail: string;
  notifyPaidOrders: boolean;
  notifyNewTickets: boolean;
};

/** JSON shape for admin and public settings. Image bytes stay in the database. */
export function settingsView(row: SettingsRow) {
  return {
    siteName: row.siteName,
    supportEmail: row.supportEmail,
    supportHours: row.supportHours,
    footerText: row.footerText,
    wechatId: row.wechatId,
    qq: row.qq,
    contactEmail: row.contactEmail,
    qrImageUrl: row.qrImageUrl || "",
    hasContactQr: Boolean(row.qrImageUrl || (row.qrImageData && row.qrImageMime)),
    adminTotpRequired: row.adminTotpRequired,
    announcementText: row.announcementText,
    announcementEnabled: row.announcementEnabled,
    orderExpireMinutes: row.orderExpireMinutes,
  };
}

/** Admin settings include the notification address. The public JSON does not. */
export function adminSettingsView(row: SettingsRow) {
  return {
    ...settingsView(row),
    adminNotifyEmail: row.adminNotifyEmail,
    notifyPaidOrders: row.notifyPaidOrders,
    notifyNewTickets: row.notifyNewTickets,
  };
}

export function contactEmailOf(row: { contactEmail: string; supportEmail: string }) {
  const specific = row.contactEmail.trim();
  return specific || row.supportEmail;
}

export function isQrMime(value: string): value is QrMime {
  return (QR_MIMES as readonly string[]).includes(value);
}

export function decodeQrImage(mime: string, base64: string) {
  if (!isQrMime(mime)) return null;
  const cleaned = base64.trim().replace(/^data:[^,]+,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(cleaned)) return null;
  const bytes = Buffer.from(cleaned, "base64");
  if (bytes.length < 16 || bytes.length > MAX_QR_BYTES) return null;
  if (mime === "image/png" && !bytes.subarray(0, 8).equals(PNG)) return null;
  if (mime === "image/jpeg" && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return null;
  if (mime === "image/webp") {
    if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  }
  return { mime, data: bytes.toString("base64") };
}

/** Stable id so a changed announcement shows again after dismiss. */
export function announcementKey(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
