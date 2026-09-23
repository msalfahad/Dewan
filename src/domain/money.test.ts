import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney, parseKwdToFils, sumFils } from './money';

describe('KWD money in integer fils', () => {
  it('parses amounts into integer fils without floating point', () => {
    expect(parseKwdToFils('50.000')).toBe(50_000);
    expect(parseKwdToFils('6.085')).toBe(6_085);
    expect(parseKwdToFils('1,000.000')).toBe(1_000_000);
    expect(parseKwdToFils('0.1')).toBe(100);
    expect(parseKwdToFils('0.001')).toBe(1);
    expect(parseKwdToFils('٥٠٫٥')).toBe(50_500);
  });

  it('rejects more than three decimals and garbage', () => {
    expect(parseKwdToFils('1.0001')).toBeNull();
    expect(parseKwdToFils('abc')).toBeNull();
    expect(parseKwdToFils('')).toBeNull();
  });

  it('avoids binary floating-point drift (0.1 + 0.2)', () => {
    const total = sumFils([parseKwdToFils('0.1')!, parseKwdToFils('0.2')!]);
    expect(total).toBe(300);
    expect(formatAmount(total)).toBe('0.300');
  });

  it('always displays exactly three decimals', () => {
    expect(formatAmount(950_000)).toBe('950.000');
    expect(formatAmount(1_000_000)).toBe('1,000.000');
    expect(formatAmount(6_085)).toBe('6.085');
    expect(formatAmount(-50_000)).toBe('-50.000');
    expect(formatAmount(0)).toBe('0.000');
  });

  it('shows the currency per language: "950.000 د.ك" and "KWD 950.000"', () => {
    expect(formatMoney(950_000, 'ar')).toBe('950.000 د.ك');
    expect(formatMoney(950_000, 'en')).toBe('KWD 950.000');
  });

  it('refuses non-integer fils', () => {
    expect(() => formatAmount(0.5)).toThrow();
  });
});
