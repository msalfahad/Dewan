// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildLedger } from '../domain/ledger';
import { demoData } from '../domain/demo';
import { mergeCategories } from '../domain/categories';
import { indexCategories } from '../domain/text';
import { buildReportModel, type ReportLanguage } from './reportModel';
import { layoutColumns, PDF_PAGE, renderReportPdf } from './pdfReport';
import { toVisualString, visualRuns } from './bidiText';

const fonts = {
  regular: new Uint8Array(fs.readFileSync('public/fonts/IBMPlexSansArabic-Regular.ttf')),
  bold: new Uint8Array(fs.readFileSync('public/fonts/IBMPlexSansArabic-Bold.ttf')),
};
const demo = demoData('u');
const ledger = buildLedger(demo.openingBalance, demo.transactions, '2026-09-23');
const categoriesById = indexCategories(mergeCategories([]));
const model = (language: ReportLanguage, months = ['2026-09', '2026-10']) =>
  buildReportModel({ ledger, months, language, categoriesById, openingBalance: demo.openingBalance, generatedOn: '2026-09-23' });

describe('PDF rendering', () => {
  it.each(['ar', 'en', 'both'] as ReportLanguage[])('renders a valid multi-page %s PDF with the embedded Arabic font', async (language) => {
    const bytes = await renderReportPdf(model(language), fonts);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw).toContain('IBMPlexSansArabic');
    expect(raw).toContain('/FontFile2'); // font program embedded, not referenced
  }, 30_000);

  it('repeats the table header when a month spans several pages', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...demo.transactions[0], id: `m${i}`, createdAt: i, date: '2026-09-05' }));
    const big = buildLedger(demo.openingBalance, many, '2026-09-23');
    const m = buildReportModel({ ledger: big, months: ['2026-09'], language: 'ar', categoriesById, openingBalance: demo.openingBalance });
    const doc = await PDFDocument.load(await renderReportPdf(m, fonts));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  }, 30_000);
});

describe('PDF ledger layout', () => {
  it.each(['ar', 'en', 'both'] as ReportLanguage[])('%s: balance column is always laid out inside the printable width', (language) => {
    const cols = layoutColumns(model(language).columns);
    const balance = cols.find((c) => c.key === 'balance')!;
    expect(balance).toBeDefined();
    expect(balance.width).toBeGreaterThan(60);
    const last = cols[cols.length - 1];
    expect(last.start + last.width).toBeCloseTo(PDF_PAGE.margin + PDF_PAGE.contentWidth, 3);
  });

  it('refuses a ledger table without the balance column', () => {
    const cols = model('en').columns.filter((c) => c.key !== 'balance');
    expect(() => layoutColumns(cols)).toThrow(/balance/);
  });
});

describe('Arabic bidi ordering in the PDF', () => {
  it('keeps Arabic words in logical order for shaping and places runs right-to-left', () => {
    const runs = visualRuns('حبوب قهوة', 'rtl');
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ text: 'حبوب قهوة', rtl: true, arabic: true });
  });

  it('orders mixed Arabic / English / numbers correctly', () => {
    // "التاريخ / Date" in an RTL paragraph: Arabic on the right, English on the left.
    const runs = visualRuns('التاريخ / Date', 'rtl');
    expect(runs[0].text).toBe('Date');
    expect(runs[runs.length - 1].text).toContain('التاريخ');
    // Currency: number on the right of the Arabic abbreviation when read RTL.
    expect(toVisualString('950.000 د.ك', 'rtl')).toBe('ك.د 950.000');
    expect(toVisualString('KWD 950.000', 'ltr')).toBe('KWD 950.000');
  });
});
