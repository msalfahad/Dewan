import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';
import appConfig from '../config/app.json';
import { formatLongDate, monthLabel, translate, translateBoth } from './translate';

function keys(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [prefix];
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe('translations', () => {
  it('ar.json and en.json have exactly the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it('uses the new app name حساب الديوان / Diwaniya Account everywhere', () => {
    expect(translate('ar', 'app.name')).toBe('حساب الديوان');
    expect(translate('en', 'app.name')).toBe('Diwaniya Account');
    expect(appConfig.nameAr).toBe('حساب الديوان');
    expect(appConfig.nameEn).toBe('Diwaniya Account');
    expect(JSON.stringify(ar)).not.toContain('حساب البيت');
    expect(translate('ar', 'ledger.title')).toBe('سجل حساب الديوان');
    expect(translate('en', 'ledger.title')).toBe('Diwaniya Account Ledger');
  });

  it('formats Arabic and English month names and dates', () => {
    expect(monthLabel('ar', '2026-09')).toBe('سبتمبر 2026');
    expect(monthLabel('en', '2026-09')).toBe('September 2026');
    expect(formatLongDate('ar', '2026-09-05')).toBe('5 سبتمبر 2026');
    expect(formatLongDate('en', '2026-09-05')).toBe('5 September 2026');
  });

  it('builds bilingual labels', () => {
    expect(translateBoth('columns.balance')).toBe('الرصيد / Balance');
    expect(translate('en', 'add.salaryDescription', { name: 'Raju', month: 'September 2026' })).toBe('Raju salary for September 2026');
  });
});
