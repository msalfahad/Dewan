import type { Lang } from '../config/app';
import { formatAmount, normalizeDigits } from './money';
import { formatDateDMY, monthKeyOf, yearOf } from './dates';
import type { LedgerRow } from './ledger';
import type { Category, EffectiveStatus, PaymentMethod, TransactionType } from './types';
import { describe, txCategory } from './text';

export type StatusFilter = 'paid' | 'due' | 'overdue' | 'received' | 'pending';

export interface LedgerFilter {
  search: string;
  types: TransactionType[];
  categoryIds: string[];
  paymentMethods: PaymentMethod[];
  statuses: StatusFilter[];
  months: string[];
  years: string[];
}

export const EMPTY_FILTER: LedgerFilter = {
  search: '',
  types: [],
  categoryIds: [],
  paymentMethods: [],
  statuses: [],
  months: [],
  years: [],
};

export function isFilterActive(f: LedgerFilter): boolean {
  return (
    f.search.trim() !== '' ||
    f.types.length > 0 ||
    f.categoryIds.length > 0 ||
    f.paymentMethods.length > 0 ||
    f.statuses.length > 0 ||
    f.months.length > 0 ||
    f.years.length > 0
  );
}

function statusMatches(status: EffectiveStatus | 'opening', wanted: StatusFilter[]): boolean {
  if (status === 'opening') return false;
  return wanted.includes(status);
}

/** Text used for free search: descriptions, category (both languages), person/company/shop, amount, date, notes. */
export function searchHaystack(row: LedgerRow, categoriesById: ReadonlyMap<string, Category>, openingLabels: string[]): string {
  if (row.kind === 'opening') {
    const amount = row.inflowFils - row.outflowFils;
    return [...openingLabels, formatAmount(amount), formatAmount(amount).replace(/,/g, ''), row.date, formatDateDMY(row.date)]
      .join(' ')
      .toLowerCase();
  }
  const tx = row.transaction!;
  const cat = txCategory(tx, categoriesById);
  const amount = formatAmount(tx.amountFils);
  return [
    tx.description,
    tx.descriptionAr ?? '',
    tx.descriptionEn ?? '',
    cat.nameAr,
    cat.nameEn,
    tx.counterparty,
    tx.notes,
    amount,
    amount.replace(/,/g, ''),
    tx.date,
    formatDateDMY(tx.date),
  ]
    .join(' ')
    .toLowerCase();
}

export function filterLedgerRows(
  rows: readonly LedgerRow[],
  filter: LedgerFilter,
  categoriesById: ReadonlyMap<string, Category>,
  openingLabels: string[] = [],
): LedgerRow[] {
  const q = normalizeDigits(filter.search).trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  const structural =
    filter.types.length > 0 || filter.categoryIds.length > 0 || filter.paymentMethods.length > 0 || filter.statuses.length > 0;
  return rows.filter((row) => {
    if (filter.months.length && !filter.months.includes(monthKeyOf(row.date))) return false;
    if (filter.years.length && !filter.years.includes(yearOf(row.date))) return false;
    if (row.kind === 'opening') {
      if (structural) return false;
    } else {
      const tx = row.transaction!;
      if (filter.types.length && !filter.types.includes(tx.transactionType)) return false;
      if (filter.categoryIds.length && !filter.categoryIds.includes(tx.categoryId)) return false;
      if (filter.paymentMethods.length && (!tx.paymentMethod || !filter.paymentMethods.includes(tx.paymentMethod))) return false;
      if (filter.statuses.length && !statusMatches(row.status, filter.statuses)) return false;
    }
    if (terms.length) {
      const hay = searchHaystack(row, categoriesById, openingLabels);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export interface FilteredTotals {
  inflowFils: number;
  outflowFils: number;
  netFils: number;
  count: number;
}

/** Totals of completed movements among filtered transactions (the opening balance is not a movement). */
export function filteredTotals(rows: readonly LedgerRow[]): FilteredTotals {
  let inflow = 0;
  let outflow = 0;
  let count = 0;
  for (const r of rows) {
    if (r.kind === 'opening') continue;
    count += 1;
    if (!r.applied) continue;
    inflow += r.inflowFils;
    outflow += r.outflowFils;
  }
  return { inflowFils: inflow, outflowFils: outflow, netFils: inflow - outflow, count };
}

export function rowDescription(row: LedgerRow, lang: Lang, openingLabel: string): string {
  if (row.kind === 'opening') return openingLabel;
  return describe(row.transaction!, lang);
}
