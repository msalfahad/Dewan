/** Date helpers operating on ISO strings (YYYY-MM-DD) so no timezone drift can occur. */

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** "2026-09-05" → "2026-09" */
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function yearOf(isoDate: string): string {
  return isoDate.slice(0, 4);
}

/** "2026-09-05" → "05/09/2026" */
export function formatDateDMY(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function compareMonthKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
