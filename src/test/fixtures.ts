import { DEFAULT_CATEGORIES } from '../domain/categories';
import type { OpeningBalance, PaymentMethod, StoredStatus, Transaction, TransactionType } from '../domain/types';

let counter = 0;

export function tx(partial: Partial<Transaction> & { transactionType: TransactionType; amountFils: number; date: string }): Transaction {
  counter += 1;
  const catId = partial.categoryId ?? (partial.transactionType === 'inflow' ? 'in-family' : 'out-groceries');
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === catId);
  const status: StoredStatus = partial.status ?? (partial.transactionType === 'inflow' ? 'received' : 'paid');
  return {
    id: partial.id ?? `t${String(counter).padStart(4, '0')}`,
    userId: 'u1',
    description: partial.description ?? `tx ${counter}`,
    categoryId: catId,
    categoryNameAr: cat?.nameAr ?? catId,
    categoryNameEn: cat?.nameEn ?? catId,
    paymentMethod: (partial.paymentMethod ?? 'cash') as PaymentMethod,
    counterparty: partial.counterparty ?? '',
    notes: '',
    createdAt: partial.createdAt ?? 1_000 + counter,
    updatedAt: partial.updatedAt ?? 1_000 + counter,
    ...partial,
    status,
  };
}

export const OPENING_1000: OpeningBalance = { amountFils: 1_000_000, date: '2026-09-01', description: '' };

/** The required example: Coffee beans, Groceries, 05/09/2026, outflow 50.000 KWD. */
export function coffeeBeans(): Transaction {
  return tx({
    id: 'coffee',
    transactionType: 'outflow',
    date: '2026-09-05',
    description: 'حبوب قهوة',
    descriptionAr: 'حبوب قهوة',
    descriptionEn: 'Coffee beans',
    categoryId: 'out-groceries',
    amountFils: 50_000,
  });
}
