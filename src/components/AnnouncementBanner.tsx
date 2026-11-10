import { cookies } from "next/headers";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getPublicSettings } from "@/lib/public-content";
import { announcementKey } from "@/lib/site-settings";
import { DismissAnnouncement } from "./DismissAnnouncement";

export async function AnnouncementBanner() {
  const settings = await getPublicSettings();
  const text = settings?.announcementText.trim() ?? "";
  if (!settings?.announcementEnabled || !text) return null;
  const key = announcementKey(text);
  const dismissed = (await cookies()).get("aisubscr-announce")?.value;
  if (dismissed === key) return null;
  const t = getDict(await getLocale());
  return (
    <div className="announce">
      <div className="container announce-inner">
        <p>{text}</p>
        <DismissAnnouncement storageKey={key} label={t.common.dismiss} />
      </div>
    </div>
  );
}
