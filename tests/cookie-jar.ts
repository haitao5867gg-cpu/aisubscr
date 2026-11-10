export const cookieJar = new Map<string, string>();

export function resetCookieJar() {
  cookieJar.clear();
}

export function sessionSeal() {
  return cookieJar.get("aisubscr_session");
}

export function setSessionSeal(value: string | undefined) {
  if (value) cookieJar.set("aisubscr_session", value);
  else cookieJar.delete("aisubscr_session");
}
