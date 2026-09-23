import type { AppData, Category, OpeningBalance, RecurringExpense, Transaction } from '../domain/types';

export interface StoredData {
  transactions: Transaction[];
  /** Custom categories and overrides of defaults (e.g. archived or renamed defaults). */
  categories: Category[];
  recurring: RecurringExpense[];
  openingBalance: OpeningBalance | null;
}

export const EMPTY_DATA: StoredData = { transactions: [], categories: [], recurring: [], openingBalance: null };

export interface DataRepository {
  readonly kind: 'firebase' | 'local';
  readonly userId: string;
  subscribe(listener: (data: StoredData) => void): () => void;
  saveTransaction(tx: Transaction): Promise<void>;
  saveTransactions(txs: Transaction[]): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCategory(category: Category): Promise<void>;
  saveRecurring(item: RecurringExpense): Promise<void>;
  deleteRecurring(id: string): Promise<void>;
  saveOpeningBalance(opening: OpeningBalance | null): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
}
