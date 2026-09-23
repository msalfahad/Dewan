/** Category analysis: totals, counts, share of outflow, paid vs unpaid. */
import type { LedgerRow } from './ledger';
import { shareTenthsOfPercent } from './money';
import type { Category, TransactionType } from './types';
import { txCategory } from './text';

export interface CategoryTotal {
  categoryId: string;
  kind: TransactionType;
  nameAr: string;
  nameEn: string;
  icon: string;
  /** Received inflow or paid outflow. */
  paidFils: number;
  /** Pending inflow or due/overdue outflow. */
  unpaidFils: number;
  count: number;
  /** Share of total paid outflow (outflow categories only), in tenths of a percent. */
  shareTenths: number;
}

export interface CategoryAnalysis {
  inflow: CategoryTotal[];
  outflow: CategoryTotal[];
  totalInflowFils: number;
  totalOutflowFils: number;
  totalPaidFils: number;
  totalDueFils: number;
}

export function analyzeCategories(rows: readonly LedgerRow[], categoriesById: ReadonlyMap<string, Category>): CategoryAnalysis {
  const map = new Map<string, CategoryTotal>();
  for (const row of rows) {
    if (row.kind !== 'transaction' || !row.transaction) continue;
    const tx = row.transaction;
    const cat = txCategory(tx, categoriesById);
    const key = tx.categoryId;
    let t = map.get(key);
    if (!t) {
      t = { categoryId: key, kind: tx.transactionType, nameAr: cat.nameAr, nameEn: cat.nameEn, icon: cat.icon, paidFils: 0, unpaidFils: 0, count: 0, shareTenths: 0 };
      map.set(key, t);
    }
    t.count += 1;
    if (row.applied) t.paidFils += tx.amountFils;
    else t.unpaidFils += tx.amountFils;
  }
  const all = [...map.values()];
  const inflow = all.filter((t) => t.kind === 'inflow').sort((a, b) => b.paidFils - a.paidFils);
  const outflow = all.filter((t) => t.kind === 'outflow').sort((a, b) => b.paidFils - a.paidFils);
  const totalInflow = inflow.reduce((s, t) => s + t.paidFils, 0);
  const totalOutflow = outflow.reduce((s, t) => s + t.paidFils, 0);
  for (const t of outflow) t.shareTenths = shareTenthsOfPercent(t.paidFils, totalOutflow);
  for (const t of inflow) t.shareTenths = shareTenthsOfPercent(t.paidFils, totalInflow);
  return {
    inflow,
    outflow,
    totalInflowFils: totalInflow,
    totalOutflowFils: totalOutflow,
    totalPaidFils: totalOutflow,
    totalDueFils: outflow.reduce((s, t) => s + t.unpaidFils, 0),
  };
}

export interface MonthlyFlow {
  month: string;
  inflowFils: number;
  outflowFils: number;
  dueFils: number;
}

export function monthlyFlows(rows: readonly LedgerRow[]): MonthlyFlow[] {
  const map = new Map<string, MonthlyFlow>();
  for (const r of rows) {
    if (r.kind !== 'transaction') continue;
    const m = r.date.slice(0, 7);
    let f = map.get(m);
    if (!f) {
      f = { month: m, inflowFils: 0, outflowFils: 0, dueFils: 0 };
      map.set(m, f);
    }
    if (r.applied) {
      f.inflowFils += r.inflowFils;
      f.outflowFils += r.outflowFils;
    } else f.dueFils += r.outflowFils;
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}
