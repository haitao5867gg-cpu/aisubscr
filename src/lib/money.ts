/** Store prices in fen (分); display as ¥x.xx */
export function formatRmb(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}
