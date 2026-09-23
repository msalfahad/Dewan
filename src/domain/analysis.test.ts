import { describe, expect, it } from 'vitest';
import { analyzeCategories } from './analysis';
import { mergeCategories, categoryName } from './categories';
import { buildLedger } from './ledger';
import { indexCategories } from './text';
import { formatShare } from './money';
import { EMPTY_FILTER, filteredTotals, filterLedgerRows } from './filters';
import { coffeeBeans, OPENING_1000, tx } from '../test/fixtures';

const cats = indexCategories(mergeCategories([]));

function ledger() {
  return buildLedger(
    OPENING_1000,
    [
      coffeeBeans(),
      tx({ transactionType: 'outflow', amountFils: 150_000, date: '2026-09-06', categoryId: 'out-maintenance', counterparty: 'شركة التبريد', paymentMethod: 'paymentLink' }),
      tx({ transactionType: 'outflow', amountFils: 30_000, date: '2026-09-28', categoryId: 'out-groceries', status: 'due', counterparty: 'Sultan Center' }),
      tx({ transactionType: 'inflow', amountFils: 200_000, date: '2026-09-07', categoryId: 'in-family' }),
      tx({ transactionType: 'inflow', amountFils: 50_000, date: '2026-10-07', categoryId: 'in-family', status: 'pending' }),
    ],
    '2026-09-23',
  );
}

describe('category totals', () => {
  it('totals inflow/outflow per category with counts, share, paid and unpaid', () => {
    const a = analyzeCategories(ledger().rows, cats);
    const groceries = a.outflow.find((c) => c.categoryId === 'out-groceries')!;
    const maintenance = a.outflow.find((c) => c.categoryId === 'out-maintenance')!;
    expect(groceries.paidFils).toBe(50_000);
    expect(groceries.unpaidFils).toBe(30_000);
    expect(groceries.count).toBe(2);
    expect(maintenance.paidFils).toBe(150_000);
    expect(formatShare(maintenance.shareTenths)).toBe('75.0%');
    expect(formatShare(groceries.shareTenths)).toBe('25.0%');
    expect(a.totalPaidFils).toBe(200_000);
    expect(a.totalDueFils).toBe(30_000);
    const family = a.inflow.find((c) => c.categoryId === 'in-family')!;
    expect(family.paidFils).toBe(200_000);
    expect(family.unpaidFils).toBe(50_000);
    expect(family.count).toBe(2);
  });

  it('excludes the opening balance from category totals', () => {
    const a = analyzeCategories(buildLedger(OPENING_1000, [], '2026-09-23').rows, cats);
    expect(a.inflow).toHaveLength(0);
    expect(a.totalInflowFils).toBe(0);
  });

  it('falls back to the entered name when a custom category has no English name', () => {
    expect(categoryName({ nameAr: 'تنظيف', nameEn: '' }, 'en')).toBe('تنظيف');
    expect(categoryName({ nameAr: 'تنظيف', nameEn: 'Cleaning' }, 'en')).toBe('Cleaning');
  });
});

describe('search and filters', () => {
  const rows = ledger().rows;

  it('filters by type, category, status, payment method and month', () => {
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, types: ['inflow'] }, cats)).toHaveLength(2);
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, categoryIds: ['out-groceries'] }, cats)).toHaveLength(2);
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, statuses: ['due'] }, cats)).toHaveLength(1);
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, statuses: ['overdue'] }, cats)).toHaveLength(0);
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, paymentMethods: ['paymentLink'] }, cats)).toHaveLength(1);
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, months: ['2026-10'] }, cats)).toHaveLength(1);
    expect(filterLedgerRows(rows, { ...EMPTY_FILTER, years: ['2026'] }, cats)).toHaveLength(6);
  });

  it('searches description (both languages), category, person/shop, amount and date', () => {
    const s = (search: string) => filterLedgerRows(rows, { ...EMPTY_FILTER, search }, cats).map((r) => r.key);
    expect(s('coffee')).toEqual(['coffee']);
    expect(s('قهوة')).toEqual(['coffee']);
    expect(s('مشتريات')).toHaveLength(2);
    expect(s('sultan')).toHaveLength(1);
    expect(s('التبريد')).toHaveLength(1);
    expect(s('50.000')).toContain('coffee');
    expect(s('05/09/2026')).toEqual(['coffee']);
  });

  it('reports filtered inflow, outflow, net and count', () => {
    const filtered = filterLedgerRows(rows, { ...EMPTY_FILTER, months: ['2026-09'] }, cats);
    const totals = filteredTotals(filtered);
    expect(totals.inflowFils).toBe(200_000);
    expect(totals.outflowFils).toBe(200_000);
    expect(totals.netFils).toBe(0);
    expect(totals.count).toBe(4);
  });
});
