/**
 * THE RUNNING-BALANCE ENGINE.
 *
 * The balance shown on every row is derived — never stored. It is recomputed from the
 * opening balance and the chronologically ordered transactions every time data changes,
 * so editing or deleting any historical transaction automatically corrects every later row.
 *
 *   Balance after transaction = Previous balance + received inflow − paid outflow
 *
 * Only completed cash movements (received inflows / paid outflows) change the balance.
 * Pending inflows and due/overdue outflows appear in the ledger but carry the balance forward
 * unchanged; due outflows are counted as unpaid commitments.
 */
import { assertFils } from './money';
import type { EffectiveStatus, OpeningBalance, Transaction } from './types';

export interface LedgerRow {
  /** Stable key: "opening" or the transaction id. */
  key: string;
  kind: 'opening' | 'transaction';
  date: string;
  transaction: Transaction | null;
  /** Amount shown in the Inflow column (0 when not an inflow). */
  inflowFils: number;
  /** Amount shown in the Outflow column (0 when not an outflow). */
  outflowFils: number;
  /** Whether this row actually moved cash (received / paid / opening). */
  applied: boolean;
  status: EffectiveStatus | 'opening';
  balanceBeforeFils: number;
  balanceAfterFils: number;
  /** 1-based position in the full ledger. */
  sequence: number;
}

export interface LedgerSummary {
  openingFils: number;
  currentBalanceFils: number;
  totalInflowFils: number;
  totalOutflowFils: number;
  unpaidCommitmentsFils: number;
  pendingInflowFils: number;
  balanceAfterCommitmentsFils: number;
  transactionCount: number;
}

export interface Ledger {
  rows: LedgerRow[];
  summary: LedgerSummary;
}

/**
 * Chronological order: 1) transaction date, 2) created time, 3) document id (stable tie-breaker).
 * Uses plain code-unit comparison for ids so the order is identical on every device.
 */
export function compareTransactions(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function sortTransactions(list: readonly Transaction[]): Transaction[] {
  return [...list].sort(compareTransactions);
}

export function effectiveStatus(tx: Transaction, today: string): EffectiveStatus {
  if (tx.transactionType === 'outflow' && tx.status === 'due' && tx.date < today) return 'overdue';
  return tx.status;
}

/** True when the transaction is a completed cash movement. */
export function isApplied(tx: Transaction): boolean {
  return tx.transactionType === 'inflow' ? tx.status === 'received' : tx.status === 'paid';
}

export function isUnpaidCommitment(tx: Transaction): boolean {
  return tx.transactionType === 'outflow' && tx.status === 'due';
}

/** Builds the full chronological ledger with the balance after every row. */
export function buildLedger(
  opening: OpeningBalance | null,
  transactions: readonly Transaction[],
  today: string,
): Ledger {
  const sorted = sortTransactions(transactions);
  const rows: LedgerRow[] = [];
  let balance = 0;
  let openingPlaced = opening === null;
  let totalInflow = 0;
  let totalOutflow = 0;
  let unpaid = 0;
  let pendingIn = 0;

  const placeOpening = () => {
    if (!opening) return;
    const before = balance;
    balance = before + assertFils(opening.amountFils);
    rows.push({
      key: 'opening',
      kind: 'opening',
      date: opening.date,
      transaction: null,
      inflowFils: opening.amountFils >= 0 ? opening.amountFils : 0,
      outflowFils: opening.amountFils < 0 ? -opening.amountFils : 0,
      applied: true,
      status: 'opening',
      balanceBeforeFils: before,
      balanceAfterFils: balance,
      sequence: rows.length + 1,
    });
    openingPlaced = true;
  };

  for (const tx of sorted) {
    // The opening balance starts the ledger on its effective date, before same-day transactions.
    if (!openingPlaced && opening && opening.date <= tx.date) placeOpening();
    const amount = assertFils(tx.amountFils);
    const applied = isApplied(tx);
    const before = balance;
    if (applied) {
      if (tx.transactionType === 'inflow') {
        balance = before + amount;
        totalInflow += amount;
      } else {
        balance = before - amount;
        totalOutflow += amount;
      }
    } else if (tx.transactionType === 'outflow') {
      unpaid += amount;
    } else {
      pendingIn += amount;
    }
    rows.push({
      key: tx.id,
      kind: 'transaction',
      date: tx.date,
      transaction: tx,
      inflowFils: tx.transactionType === 'inflow' ? amount : 0,
      outflowFils: tx.transactionType === 'outflow' ? amount : 0,
      applied,
      status: effectiveStatus(tx, today),
      balanceBeforeFils: before,
      balanceAfterFils: balance,
      sequence: rows.length + 1,
    });
  }
  if (!openingPlaced) placeOpening();

  return {
    rows,
    summary: {
      openingFils: opening?.amountFils ?? 0,
      currentBalanceFils: balance,
      totalInflowFils: totalInflow,
      totalOutflowFils: totalOutflow,
      unpaidCommitmentsFils: unpaid,
      pendingInflowFils: pendingIn,
      balanceAfterCommitmentsFils: balance - unpaid,
      transactionCount: transactions.length,
    },
  };
}

/** Transactions dated before the opening balance date (shown as a warning in the UI). */
export function transactionsBeforeOpening(opening: OpeningBalance | null, txs: readonly Transaction[]): Transaction[] {
  if (!opening) return [];
  return txs.filter((t) => t.date < opening.date);
}
