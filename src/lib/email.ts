/** Same address key used when creating an account. */
export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}
