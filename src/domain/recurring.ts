import { daysInMonth } from './dates';
import type { Category, RecurringExpense, Transaction } from './types';
import { newId } from './transactions';

/**
 * Creates the due outflows for a month from active recurring expenses,
 * skipping any that were already generated for that month.
 */
export function generateRecurringForMonth(
  templates: readonly RecurringExpense[],
  month: string,
  existing: readonly Transaction[],
  categoriesById: ReadonlyMap<string, Category>,
  userId: string,
  now: number = Date.now(),
): Transaction[] {
  const done = new Set(existing.filter((t) => t.recurringMonth === month).map((t) => t.recurringId));
  const out: Transaction[] = [];
  templates.forEach((r, i) => {
    if (!r.active || done.has(r.id)) return;
    const cat = categoriesById.get(r.categoryId);
    if (!cat) return;
    const day = Math.min(Math.max(1, r.dayOfMonth), daysInMonth(month));
    const date = `${month}-${String(day).padStart(2, '0')}`;
    out.push({
      id: newId(),
      userId,
      transactionType: 'outflow',
      date,
      dueDate: date,
      description: r.description,
      descriptionEn: r.descriptionEn || undefined,
      categoryId: cat.id,
      categoryNameAr: cat.nameAr,
      categoryNameEn: cat.nameEn,
      amountFils: r.amountFils,
      paymentMethod: r.paymentMethod,
      counterparty: r.counterparty,
      status: 'due',
      notes: '',
      createdAt: now + i,
      updatedAt: now + i,
      recordKind: cat.recordKind ?? 'general',
      recurringId: r.id,
      recurringMonth: month,
    });
  });
  return out;
}
