/**
 * Kuwaiti dinar money helpers.
 * All amounts are integer fils (1 KWD = 1,000 fils). No floating-point arithmetic is
 * used on money: parsing is done on the decimal string, and formatting uses integer
 * division/modulo only.
 */
import type { Lang } from '../config/app';

export const FILS_PER_KWD = 1000;

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** Converts Arabic-Indic digits and the Arabic decimal/thousands separators to ASCII. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const e = EASTERN_ARABIC_INDIC.indexOf(ch);
    if (a >= 0) out += String(a);
    else if (e >= 0) out += String(e);
    else if (ch === '٫') out += '.';
    else if (ch === '٬' || ch === '،') out += ',';
    else out += ch;
  }
  return out;
}

/**
 * Parses a KWD amount typed by the user into integer fils.
 * "50" → 50000, "6.085" → 6085, "1,000.000" → 1000000.
 * Returns null for invalid input or more than three decimal places.
 */
export function parseKwdToFils(input: string): number | null {
  const s = normalizeDigits(input).trim().replace(/,/g, '').replace(/\s/g, '');
  if (s === '') return null;
  const m = /^(-)?(\d*)(?:\.(\d{0,3}))?$/.exec(s);
  if (!m) return null;
  const [, neg, whole, frac = ''] = m;
  if (whole === '' && frac === '') return null;
  const wholeFils = Number(whole || '0') * FILS_PER_KWD;
  const fracFils = Number(frac.padEnd(3, '0'));
  const fils = wholeFils + fracFils;
  if (!Number.isSafeInteger(fils)) return null;
  return neg ? -fils : fils;
}

/** Asserts a value is a safe integer number of fils. */
export function assertFils(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid fils amount: ${value}`);
  return value;
}

/** Sums fils amounts using integer addition only. */
export function sumFils(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += assertFils(v);
  return total;
}

/** "1,000.000" — always three decimals, comma thousands separator, Latin digits. */
export function formatAmount(fils: number): string {
  assertFils(fils);
  const negative = fils < 0;
  const abs = Math.abs(fils);
  const whole = Math.trunc(abs / FILS_PER_KWD);
  const frac = abs % FILS_PER_KWD;
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${wholeStr}.${String(frac).padStart(3, '0')}`;
}

/** Plain decimal for form inputs: "1000.000". */
export function filsToInput(fils: number): string {
  return formatAmount(fils).replace(/,/g, '');
}

export const CURRENCY = { ar: 'د.ك', en: 'KWD' } as const;

/** Arabic: "950.000 د.ك"; English: "KWD 950.000". */
export function formatMoney(fils: number, lang: Lang): string {
  const amount = formatAmount(fils);
  return lang === 'ar' ? `${amount} ${CURRENCY.ar}` : `${CURRENCY.en} ${amount}`;
}

/** Percentage (one decimal) of part/whole using integer math: returns tenths of a percent. */
export function shareTenthsOfPercent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part * 1000) / whole);
}

export function formatShare(tenths: number): string {
  return `${Math.trunc(tenths / 10)}.${Math.abs(tenths % 10)}%`;
}
