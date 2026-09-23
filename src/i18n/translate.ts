/**
 * Centralized translation lookup. All interface text lives in ar.json / en.json;
 * components and the PDF generator call t()/translate() with a key.
 */
import ar from './ar.json';
import en from './en.json';
import type { Lang } from '../config/app';

export type Dictionary = typeof ar;
export const DICTIONARIES: Record<Lang, Dictionary> = { ar, en };
export const LANGS: Lang[] = ['ar', 'en'];

export function dirOf(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict);
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const value = lookup(DICTIONARIES[lang], key);
  if (typeof value !== 'string') {
    if (import.meta.env?.DEV) console.warn(`Missing translation: ${lang}.${key}`);
    return key;
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Both languages: "التاريخ / Date". */
export function translateBoth(key: string, vars?: Record<string, string | number>, sep = ' / '): string {
  const a = translate('ar', key, vars);
  const e = translate('en', key, vars);
  return a === e ? a : `${a}${sep}${e}`;
}

export function monthName(lang: Lang, monthIndex0: number): string {
  return DICTIONARIES[lang].months[monthIndex0];
}

/** "2026-09" → "سبتمبر 2026" / "September 2026" */
export function monthLabel(lang: Lang, monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${monthName(lang, m - 1)} ${y}`;
}

/** "2026-09-05" → "5 سبتمبر 2026" / "5 September 2026" */
export function formatLongDate(lang: Lang, iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${monthName(lang, m - 1)} ${y}`;
}

export function formatDateTime(lang: Lang, ms: number): string {
  const dt = new Date(ms);
  const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return `${formatLongDate(lang, iso)} ${time}`;
}
