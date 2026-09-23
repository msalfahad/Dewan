// @vitest-environment node
import { it } from 'vitest';
import fs from 'node:fs';
import { buildLedger } from '../domain/ledger';
import { demoData } from '../domain/demo';
import { indexCategories } from '../domain/text';
import { mergeCategories } from '../domain/categories';
import { buildReportModel, type ReportLanguage } from './reportModel';
import { renderReportPdf } from './pdfReport';

it.skipIf(!process.env.RENDER_SAMPLES)('renders sample PDFs', async () => {
  const d = demoData('u');
  const ledger = buildLedger(d.openingBalance, d.transactions, '2026-09-23');
  const fonts = { regular: fs.readFileSync('public/fonts/IBMPlexSansArabic-Regular.ttf'), bold: fs.readFileSync('public/fonts/IBMPlexSansArabic-Bold.ttf') };
  for (const language of ['ar', 'en', 'both'] as ReportLanguage[]) {
    const model = buildReportModel({ ledger, months: ['2026-09', '2026-10'], language, categoriesById: indexCategories(mergeCategories([])), openingBalance: d.openingBalance, generatedOn: '2026-09-23' });
    fs.writeFileSync(`${process.env.RENDER_SAMPLES}/report-${language}.pdf`, await renderReportPdf(model, fonts));
  }
}, 60000);
