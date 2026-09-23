/**
 * Month sections for reports. Balances carry forward from month to month because every
 * section is sliced out of the single full ledger — nothing is reset to zero at a month
 * boundary, and non-consecutive or cross-year selections still start from the true balance.
 */
import type { Ledger, LedgerRow } from './ledger';
import { monthKeyOf } from './dates';

export interface MonthSection {
  month: string;
  openingFils: number;
  inflowFils: number;
  outflowFils: number;
  closingFils: number;
  unpaidFils: number;
  pendingInflowFils: number;
  rows: LedgerRow[];
}

export interface PeriodReport {
  months: string[];
  openingFils: number;
  inflowFils: number;
  outflowFils: number;
  closingFils: number;
  unpaidFils: number;
  balanceAfterCommitmentsFils: number;
  sections: MonthSection[];
  /** All rows of the selected months in ledger order. */
  rows: LedgerRow[];
}

export function sortMonths(months: readonly string[]): string[] {
  return [...new Set(months)].sort();
}

/** Balance at the very start of a month = balance after the last ledger row dated before it. */
export function balanceAtMonthStart(ledger: Ledger, month: string): number {
  let bal = 0;
  for (const row of ledger.rows) {
    if (monthKeyOf(row.date) >= month) break;
    bal = row.balanceAfterFils;
  }
  return bal;
}

export function buildMonthSection(ledger: Ledger, month: string): MonthSection {
  const rows = ledger.rows.filter((r) => monthKeyOf(r.date) === month);
  let openingFils = balanceAtMonthStart(ledger, month);
  let inflow = 0;
  let outflow = 0;
  let unpaid = 0;
  let pendingIn = 0;
  for (const r of rows) {
    if (r.kind === 'opening') {
      // The opening balance starts the account; it is not counted as ordinary inflow.
      openingFils += r.inflowFils - r.outflowFils;
      continue;
    }
    if (r.applied) {
      inflow += r.inflowFils;
      outflow += r.outflowFils;
    } else if (r.outflowFils > 0) unpaid += r.outflowFils;
    else pendingIn += r.inflowFils;
  }
  const closingFils = rows.length ? rows[rows.length - 1].balanceAfterFils : openingFils;
  return { month, openingFils, inflowFils: inflow, outflowFils: outflow, closingFils, unpaidFils: unpaid, pendingInflowFils: pendingIn, rows };
}

export function buildPeriodReport(ledger: Ledger, months: readonly string[]): PeriodReport {
  const sorted = sortMonths(months);
  const sections = sorted.map((m) => buildMonthSection(ledger, m));
  const first = sections[0];
  const last = sections[sections.length - 1];
  const inflow = sections.reduce((s, x) => s + x.inflowFils, 0);
  const outflow = sections.reduce((s, x) => s + x.outflowFils, 0);
  const unpaid = sections.reduce((s, x) => s + x.unpaidFils, 0);
  const closing = last ? last.closingFils : 0;
  return {
    months: sorted,
    openingFils: first ? first.openingFils : 0,
    inflowFils: inflow,
    outflowFils: outflow,
    closingFils: closing,
    unpaidFils: unpaid,
    balanceAfterCommitmentsFils: closing - unpaid,
    sections,
    rows: sections.flatMap((s) => s.rows),
  };
}

/** Months (YYYY-MM) that have ledger activity, newest first. */
export function monthsWithActivity(ledger: Ledger): string[] {
  return [...new Set(ledger.rows.map((r) => monthKeyOf(r.date)))].sort().reverse();
}
