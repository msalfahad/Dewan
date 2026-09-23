import { describe, expect, it } from 'vitest';
import { buildLedger } from '../domain/ledger';
import { mergeCategories } from '../domain/categories';
import { indexCategories } from '../domain/text';
import { coffeeBeans, OPENING_1000, tx } from '../test/fixtures';
import { buildReportModel, type ReportLanguage } from './reportModel';

const categoriesById = indexCategories(mergeCategories([]));
const ledger = buildLedger(
  OPENING_1000,
  [
    coffeeBeans(),
    tx({ id: 'fam', transactionType: 'inflow', amountFils: 200_000, date: '2026-09-07', description: 'دفعة من العائلة', descriptionEn: 'Family payment', counterparty: 'أبو محمد' }),
    tx({ id: 'ac', transactionType: 'outflow', amountFils: 100_000, date: '2026-10-10', categoryId: 'out-maintenance', description: 'صيانة التكييف', descriptionEn: 'AC maintenance' }),
    tx({ id: 'sal', transactionType: 'outflow', amountFils: 120_000, date: '2026-10-30', categoryId: 'out-salaries', status: 'due', description: 'راتب' }),
  ],
  '2026-10-15',
);
const model = (language: ReportLanguage, months = ['2026-09']) =>
  buildReportModel({ ledger, months, language, categoriesById, openingBalance: OPENING_1000, generatedOn: '2026-10-15' });

const cellsOf = (m: ReturnType<typeof model>, key: string) => m.sections[0].rows.find((r) => r.cells.description.some((d) => d.includes(key)))!;

describe('Arabic report', () => {
  const m = model('ar');
  it('is RTL with Arabic headings and columns', () => {
    expect(m.dir).toBe('rtl');
    expect(m.title).toBe('تقرير حساب الديوان');
    expect(m.columns.map((c) => c.label)).toEqual(['#', 'التاريخ', 'البيان', 'التصنيف', 'من / لمن', 'طريقة الدفع', 'الوارد', 'الصادر', 'الرصيد']);
    expect(m.sections[0].title).toBe('سبتمبر 2026');
  });
  it('shows the Coffee beans row exactly as specified', () => {
    const row = cellsOf(m, 'حبوب قهوة');
    expect(row.cells.date).toEqual(['05/09/2026']);
    expect(row.cells.description).toEqual(['حبوب قهوة']);
    expect(row.cells.category).toEqual(['مشتريات']);
    expect(row.cells.inflow).toEqual(['—']);
    expect(row.cells.outflow).toEqual(['50.000']);
    expect(row.cells.balance).toEqual(['950.000']);
  });
  it('uses د.ك in summary values', () => {
    expect(m.summary[0].value).toBe('1,000.000 د.ك');
  });
});

describe('English report', () => {
  const m = model('en');
  it('is LTR with English headings', () => {
    expect(m.dir).toBe('ltr');
    expect(m.title).toBe('Diwaniya Account Report');
    expect(m.columns.map((c) => c.label)).toEqual(['#', 'Date', 'Description', 'Category', 'From / To', 'Payment Method', 'Inflow', 'Outflow', 'Balance']);
  });
  it('shows Coffee beans | Groceries | — | 50.000 | 950.000', () => {
    const row = cellsOf(m, 'Coffee beans');
    expect([row.cells.date[0], row.cells.description[0], row.cells.category[0], row.cells.inflow[0], row.cells.outflow[0], row.cells.balance[0]]).toEqual([
      '05/09/2026',
      'Coffee beans',
      'Groceries',
      '—',
      '50.000',
      '950.000',
    ]);
    expect(m.summary[3].value).toBe('KWD 1,150.000');
  });
});

describe('Bilingual report', () => {
  const m = model('both');
  it('uses combined Arabic/English headings', () => {
    expect(m.columns.map((c) => c.label)).toEqual([
      '#',
      'التاريخ / Date',
      'البيان / Description',
      'التصنيف / Category',
      'من / لمن — From / To',
      'الوارد / Inflow',
      'الصادر / Outflow',
      'الرصيد / Balance',
    ]);
    expect(m.title).toBe('تقرير حساب الديوان / Diwaniya Account Report');
    expect(m.dir).toBe('rtl');
  });
  it('shows both descriptions and category names', () => {
    const row = cellsOf(m, 'Coffee beans');
    expect(row.cells.description).toEqual(['حبوب قهوة', 'Coffee beans']);
    expect(row.cells.category).toEqual(['مشتريات', 'Groceries']);
    expect(row.cells.balance).toEqual(['950.000']);
  });
});

describe('PDF balance column', () => {
  it.each(['ar', 'en', 'both'] as ReportLanguage[])('%s report always has the balance column with a value on every row', (language) => {
    const m = model(language, ['2026-09', '2026-10']);
    expect(m.columns.at(-1)!.key).toBe('balance');
    for (const s of m.sections) for (const r of s.rows) expect(r.cells.balance[0]).toMatch(/^-?[\d,]+\.\d{3}$/);
  });

  it('carries balances across months in the report and marks unpaid rows', () => {
    const m = model('en', ['2026-09', '2026-10']);
    expect(m.period.sections[1].openingFils).toBe(1_150_000);
    const oct = m.sections[1].rows;
    expect(oct.map((r) => r.cells.balance[0])).toEqual(['1,050.000', '1,050.000']);
    expect(oct[1].isUnpaidOutflow).toBe(true);
    expect(oct[1].cells.outflow).toEqual(['120.000', '(Due)']);
    expect(m.consolidated.rows.map((r) => r[4])).toEqual(['1,150.000', '1,050.000']);
  });
});
