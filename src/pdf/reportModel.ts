/**
 * Language-resolved report model shared by the PDF generator (pdfReport.ts) and the
 * on-screen/print report preview. Arabic, English and bilingual reports differ only here:
 * every heading, column label and cell string is resolved once, then rendered.
 */
import { APP_CONFIG } from '../config/app';
import { analyzeCategories } from '../domain/analysis';
import { categoryName } from '../domain/categories';
import { formatDateDMY, todayIso } from '../domain/dates';
import type { Ledger, LedgerRow } from '../domain/ledger';
import { formatAmount, formatMoney } from '../domain/money';
import { buildPeriodReport, type PeriodReport } from '../domain/periods';
import { describe, describeBilingual, txCategory } from '../domain/text';
import type { Category, OpeningBalance } from '../domain/types';
import { formatLongDate, monthLabel, translate } from '../i18n/translate';

export type ReportLanguage = 'ar' | 'en' | 'both';

export type ColumnKey = 'number' | 'date' | 'description' | 'category' | 'counterparty' | 'paymentMethod' | 'inflow' | 'outflow' | 'balance';

export interface ReportColumn {
  key: ColumnKey;
  label: string;
  /** Relative width. The balance column always has a reserved share and is never dropped. */
  weight: number;
  numeric: boolean;
}

export type Tone = 'gold' | 'green' | 'coral' | 'amber' | 'navy' | 'blue';

export interface ReportRow {
  kind: 'opening' | 'transaction';
  applied: boolean;
  /** Each cell is one or more lines of text (bilingual cells carry an Arabic and an English line). */
  cells: Record<ColumnKey, string[]>;
  balanceFils: number;
  isUnpaidOutflow: boolean;
  isPendingInflow: boolean;
}

export interface ReportStat {
  label: string;
  value: string;
  tone: Tone;
}

export interface ReportSection {
  month: string;
  title: string;
  stats: ReportStat[];
  rows: ReportRow[];
  emptyText: string;
}

export interface ReportModel {
  language: ReportLanguage;
  dir: 'rtl' | 'ltr';
  title: string;
  subtitle: string;
  appName: string;
  generatedLabel: string;
  generatedValue: string;
  monthsLabel: string;
  monthsValue: string;
  currencyNote: string;
  /** Opening, inflow, outflow, closing, unpaid, balance after commitments. */
  summary: ReportStat[];
  /** Headline cards as in the design: total inflow, total outflow, net flow. */
  headline: (ReportStat & { icon: string })[];
  /** Balance cards: opening, closing, unpaid commitments, balance after commitments. */
  balances: ReportStat[];
  tagline: string;
  labels: {
    visualSummary: string;
    inflowVsOutflow: string;
    balanceTrend: string;
    byCategory: string;
    monthlyComparison: string;
    consolidated: string;
    detailedLedger: string;
    inflow: string;
    outflow: string;
    balance: string;
    due: string;
    month: string;
    continued: string;
    periodChart: string;
    outflowByCategory: string;
    transactionsDetail: string;
    issuedOn: string;
  };
  columns: ReportColumn[];
  consolidated: { headers: string[]; rows: string[][] };
  sections: ReportSection[];
  charts: {
    inflowFils: number;
    outflowFils: number;
    dueFils: number;
    trend: { label: string; balanceFils: number }[];
    categories: { name: string; fils: number }[];
    monthly: { label: string; inflowFils: number; outflowFils: number; dueFils: number }[];
  };
  footer: string;
  pageLabel: (page: number, total: number) => string;
  period: PeriodReport;
}

export interface ReportInput {
  ledger: Ledger;
  months: string[];
  language: ReportLanguage;
  categoriesById: ReadonlyMap<string, Category>;
  openingBalance: OpeningBalance | null;
  generatedOn?: string;
}

/** Relative widths tuned for A4 portrait; the balance column always keeps a reserved share. */
const COLUMN_WEIGHTS: Record<ColumnKey, number> = {
  number: 3.4,
  date: 9.6,
  description: 21,
  category: 11,
  counterparty: 11,
  paymentMethod: 9,
  inflow: 9.5,
  outflow: 9.5,
  balance: 11.5,
};

const NUMERIC: ColumnKey[] = ['number', 'inflow', 'outflow', 'balance'];

export const COLUMNS_SINGLE: ColumnKey[] = ['number', 'date', 'description', 'category', 'counterparty', 'paymentMethod', 'inflow', 'outflow', 'balance'];
/** Bilingual layout follows the specified column set (payment method shown under From / To). */
export const COLUMNS_BILINGUAL: ColumnKey[] = ['number', 'date', 'description', 'category', 'counterparty', 'inflow', 'outflow', 'balance'];

/** Resolves a translation key into the report language(s). */
export function reportText(language: ReportLanguage, key: string, vars?: Record<string, string | number>): string {
  if (language === 'both') {
    const ar = translate('ar', key, vars);
    const en = translate('en', key, vars);
    return ar === en ? ar : `${ar} / ${en}`;
  }
  return translate(language, key, vars);
}

function columnLabel(language: ReportLanguage, key: ColumnKey): string {
  if (language === 'both' && key === 'counterparty') return `${translate('ar', 'columns.counterparty')} — ${translate('en', 'columns.counterparty')}`;
  return reportText(language, `columns.${key}`);
}

function money(language: ReportLanguage, fils: number): string {
  return language === 'both' ? `${formatMoney(fils, 'ar')} / ${formatMoney(fils, 'en')}` : formatMoney(fils, language);
}

function monthText(language: ReportLanguage, m: string): string {
  return language === 'both' ? `${monthLabel('ar', m)} / ${monthLabel('en', m)}` : monthLabel(language, m);
}

function textLines(language: ReportLanguage, ar: string, en: string): string[] {
  if (language === 'ar') return [ar];
  if (language === 'en') return [en];
  return ar === en ? [ar] : [ar, en];
}

function buildRow(row: LedgerRow, sequence: number, input: ReportInput): ReportRow {
  const { language, categoriesById } = input;
  const dash = '—';
  const inflow = row.inflowFils ? formatAmount(row.inflowFils) : dash;
  const outflow = row.outflowFils ? formatAmount(row.outflowFils) : dash;
  if (row.kind === 'opening') {
    const custom = input.openingBalance?.description?.trim();
    const openAr = translate('ar', 'ledger.opening');
    const openEn = translate('en', 'ledger.opening');
    const desc = textLines(language, openAr, openEn);
    if (custom && custom !== openAr && custom !== openEn) desc.push(custom);
    return {
      kind: 'opening',
      applied: true,
      balanceFils: row.balanceAfterFils,
      isUnpaidOutflow: false,
      isPendingInflow: false,
      cells: {
        number: [String(sequence)],
        date: [formatDateDMY(row.date)],
        description: desc,
        category: textLines(language, translate('ar', 'status.opening'), translate('en', 'status.opening')),
        counterparty: [dash],
        paymentMethod: [dash],
        inflow: [inflow],
        outflow: [outflow],
        balance: [formatAmount(row.balanceAfterFils)],
      },
    };
  }
  const tx = row.transaction!;
  const cat = txCategory(tx, categoriesById);
  const description = language === 'both' ? describeBilingual(tx) : [describe(tx, language)];
  const method = tx.paymentMethod ? textLines(language, translate('ar', `methods.${tx.paymentMethod}`), translate('en', `methods.${tx.paymentMethod}`)) : [dash];
  const counterparty = [tx.counterparty || dash];
  if (language === 'both' && tx.paymentMethod) counterparty.push(method.join(' / '));
  const statusKey = `status.${row.status}`;
  const statusNote = row.applied ? null : `(${reportText(language, statusKey)})`;
  const inflowCell = [inflow];
  const outflowCell = [outflow];
  if (statusNote && tx.transactionType === 'inflow') inflowCell.push(statusNote);
  if (statusNote && tx.transactionType === 'outflow') outflowCell.push(statusNote);
  return {
    kind: 'transaction',
    applied: row.applied,
    balanceFils: row.balanceAfterFils,
    isUnpaidOutflow: !row.applied && tx.transactionType === 'outflow',
    isPendingInflow: !row.applied && tx.transactionType === 'inflow',
    cells: {
      number: [String(sequence)],
      date: [formatDateDMY(tx.date)],
      description,
      category: textLines(language, categoryName(cat, 'ar'), categoryName(cat, 'en')),
      counterparty,
      paymentMethod: method,
      inflow: inflowCell,
      outflow: outflowCell,
      balance: [formatAmount(row.balanceAfterFils)],
    },
  };
}

export function buildReportModel(input: ReportInput): ReportModel {
  const { ledger, language, categoriesById } = input;
  const period = buildPeriodReport(ledger, input.months);
  const dir = language === 'en' ? 'ltr' : 'rtl';
  const generated = input.generatedOn ?? todayIso();
  const L = (key: string, vars?: Record<string, string | number>) => reportText(language, key, vars);

  const columns: ReportColumn[] = (language === 'both' ? COLUMNS_BILINGUAL : COLUMNS_SINGLE).map((key) => ({
    key,
    label: columnLabel(language, key),
    weight: COLUMN_WEIGHTS[key] + (language === 'both' && key === 'counterparty' ? COLUMN_WEIGHTS.paymentMethod : 0),
    numeric: NUMERIC.includes(key),
  }));

  let seq = 0;
  const sections: ReportSection[] = period.sections.map((s) => ({
    month: s.month,
    title: monthText(language, s.month),
    stats: [
      { label: L('reports.monthOpening'), value: money(language, s.openingFils), tone: 'navy' },
      { label: L('reports.monthInflow'), value: money(language, s.inflowFils), tone: 'green' },
      { label: L('reports.monthOutflow'), value: money(language, s.outflowFils), tone: 'coral' },
      { label: L('reports.monthClosing'), value: money(language, s.closingFils), tone: 'navy' },
    ],
    rows: s.rows.map((r) => buildRow(r, ++seq, input)),
    emptyText: L('reports.noRows'),
  }));

  const analysis = analyzeCategories(period.rows, categoriesById);
  const catName = (t: { nameAr: string; nameEn: string }) =>
    language === 'both' ? `${categoryName(t, 'ar')} / ${categoryName(t, 'en')}` : categoryName(t, language);

  const consolidatedHeaders = [
    L('reports.month'),
    L('reports.monthOpening'),
    L('columns.inflow'),
    L('columns.outflow'),
    L('reports.monthClosing'),
    L('reports.unpaidCommitments'),
  ];
  const consolidatedRows = period.sections.map((s) => [
    monthText(language, s.month),
    formatAmount(s.openingFils),
    formatAmount(s.inflowFils),
    formatAmount(s.outflowFils),
    formatAmount(s.closingFils),
    formatAmount(s.unpaidFils),
  ]);

  const monthsValue = period.months.map((m) => monthText(language, m)).join(language === 'both' ? ' | ' : language === 'ar' ? '، ' : ', ');

  return {
    language,
    dir,
    title: L('reports.title'),
    subtitle: language === 'both' ? `${APP_CONFIG.nameAr} — ${APP_CONFIG.nameEn}` : language === 'ar' ? APP_CONFIG.nameAr : APP_CONFIG.nameEn,
    appName: language === 'both' ? `${APP_CONFIG.nameAr} | ${APP_CONFIG.nameEn}` : language === 'ar' ? APP_CONFIG.nameAr : APP_CONFIG.nameEn,
    generatedLabel: L('reports.generatedOn'),
    generatedValue: language === 'both' ? `${formatLongDate('ar', generated)} / ${formatLongDate('en', generated)}` : formatLongDate(language, generated),
    monthsLabel: L('reports.selectedMonths'),
    monthsValue,
    currencyNote: language === 'ar' ? 'المبالغ بالدينار الكويتي (د.ك)' : language === 'en' ? 'Amounts in Kuwaiti dinars (KWD)' : 'المبالغ بالدينار الكويتي (د.ك) / Amounts in Kuwaiti dinars (KWD)',
    summary: [
      { label: L('reports.openingBalance'), value: money(language, period.openingFils), tone: 'navy' },
      { label: L('reports.totalInflow'), value: money(language, period.inflowFils), tone: 'green' },
      { label: L('reports.totalOutflow'), value: money(language, period.outflowFils), tone: 'coral' },
      { label: L('reports.closingBalance'), value: money(language, period.closingFils), tone: 'navy' },
      { label: L('reports.unpaidCommitments'), value: money(language, period.unpaidFils), tone: 'amber' },
      { label: L('reports.balanceAfterCommitments'), value: money(language, period.balanceAfterCommitmentsFils), tone: 'blue' },
    ],
    headline: [
      { label: L('reports.totalInflow'), value: money(language, period.inflowFils), tone: 'green', icon: 'arrowOut' },
      { label: L('reports.totalOutflow'), value: money(language, period.outflowFils), tone: 'coral', icon: 'arrowIn' },
      { label: L('reports.netFlow'), value: money(language, period.inflowFils - period.outflowFils), tone: 'navy', icon: 'bars' },
    ],
    balances: [
      { label: L('reports.openingBalance'), value: money(language, period.openingFils), tone: 'navy' },
      { label: L('reports.closingBalance'), value: money(language, period.closingFils), tone: 'navy' },
      { label: L('reports.unpaidCommitments'), value: money(language, period.unpaidFils), tone: 'amber' },
      { label: L('reports.balanceAfterCommitments'), value: money(language, period.balanceAfterCommitmentsFils), tone: 'blue' },
    ],
    tagline: L('app.tagline'),
    labels: {
      periodChart: L('reports.periodChart'),
      outflowByCategory: L('reports.outflowByCategory'),
      transactionsDetail: L('reports.transactionsDetail'),
      issuedOn: L('reports.issuedOn'),
      visualSummary: L('reports.visualSummary'),
      inflowVsOutflow: L('reports.inflowVsOutflow'),
      balanceTrend: L('reports.balanceTrend'),
      byCategory: L('reports.byCategory'),
      monthlyComparison: L('reports.monthlyComparison'),
      consolidated: L('reports.consolidated'),
      detailedLedger: L('reports.detailedLedger'),
      inflow: L('columns.inflow'),
      outflow: L('columns.outflow'),
      balance: L('columns.balance'),
      due: L('status.due'),
      month: L('reports.month'),
      continued: language === 'ar' ? '(تابع)' : language === 'en' ? '(continued)' : '(تابع / continued)',
    },
    columns,
    consolidated: { headers: consolidatedHeaders, rows: consolidatedRows },
    sections,
    charts: {
      inflowFils: period.inflowFils,
      outflowFils: period.outflowFils,
      dueFils: period.unpaidFils,
      trend: period.rows.map((r) => ({ label: formatDateDMY(r.date), balanceFils: r.balanceAfterFils })),
      categories: analysis.outflow.filter((c) => c.paidFils > 0).map((c) => ({ name: catName(c), fils: c.paidFils })),
      monthly: period.sections.map((s) => ({
        label: language === 'both' ? monthLabel('en', s.month) : monthLabel(language, s.month),
        inflowFils: s.inflowFils,
        outflowFils: s.outflowFils,
        dueFils: s.unpaidFils,
      })),
    },
    footer: L('app.footer'),
    pageLabel: (page, total) => L('reports.page', { page, total }),
    period,
  };
}
