/** Datetime-local value in Asia/Shanghai, which does not observe DST. */
export function toShanghaiInput(date: Date | null) {
  if (!date) return "";
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}
