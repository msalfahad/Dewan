import type { Category, PaymentMethod, RecordKind, StoredStatus, Transaction, TransactionType } from './types';

export function newId(prefix = 'tx'): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rand.slice(0, 20)}`;
}

export interface TransactionInput {
  transactionType: TransactionType;
  date: string;
  description: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category: Category;
  amountFils: number;
  paymentMethod: PaymentMethod | null;
  counterparty: string;
  status: StoredStatus;
  notes: string;
  recordKind?: RecordKind;
  salaryMonth?: string;
}

export function defaultStatus(type: TransactionType): StoredStatus {
  return type === 'inflow' ? 'received' : 'paid';
}

export function validStatuses(type: TransactionType): StoredStatus[] {
  return type === 'inflow' ? ['received', 'pending'] : ['paid', 'due'];
}

export function createTransaction(input: TransactionInput, userId: string, now: number = Date.now(), id: string = newId()): Transaction {
  validateInput(input);
  return {
    id,
    userId,
    transactionType: input.transactionType,
    date: input.date,
    ...(input.status === 'due' ? { dueDate: input.date } : {}),
    description: input.description.trim(),
    descriptionAr: input.descriptionAr?.trim() || undefined,
    descriptionEn: input.descriptionEn?.trim() || undefined,
    categoryId: input.category.id,
    categoryNameAr: input.category.nameAr,
    categoryNameEn: input.category.nameEn,
    amountFils: input.amountFils,
    paymentMethod: input.paymentMethod,
    counterparty: input.counterparty.trim(),
    status: input.status,
    notes: input.notes.trim(),
    createdAt: now,
    updatedAt: now,
    recordKind: input.recordKind ?? input.category.recordKind ?? 'general',
    ...(input.salaryMonth ? { salaryMonth: input.salaryMonth } : {}),
  };
}

export function updateTransaction(existing: Transaction, input: TransactionInput, now: number = Date.now()): Transaction {
  const next = createTransaction(input, existing.userId, existing.createdAt, existing.id);
  return {
    ...next,
    dueDate: input.status === 'due' ? input.date : existing.dueDate,
    recurringId: existing.recurringId,
    recurringMonth: existing.recurringMonth,
    updatedAt: now,
  };
}

export function validateInput(input: TransactionInput): void {
  if (!Number.isSafeInteger(input.amountFils) || input.amountFils <= 0) throw new Error('amount');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('date');
  if (input.category.kind !== input.transactionType) throw new Error('category');
  if (!validStatuses(input.transactionType).includes(input.status)) throw new Error('status');
  if (!input.description.trim() && !input.descriptionAr?.trim() && !input.descriptionEn?.trim()) throw new Error('description');
}

/**
 * Marks a due outflow (or pending inflow) as completed on its actual payment date.
 * Moving the date re-positions it chronologically; the ledger then recalculates that row
 * and every later balance.
 */
export function markAsPaid(tx: Transaction, paymentDate: string, paymentMethod: PaymentMethod, now: number = Date.now()): Transaction {
  if (tx.status === 'paid' || tx.status === 'received') return tx;
  return {
    ...tx,
    dueDate: tx.dueDate ?? tx.date,
    date: paymentDate,
    paymentMethod,
    status: tx.transactionType === 'inflow' ? 'received' : 'paid',
    updatedAt: now,
  };
}
