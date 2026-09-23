import type { AppData, Category, OpeningBalance, RecurringExpense, Transaction } from '../domain/types';
import { EMPTY_DATA, type DataRepository, type StoredData } from './repository';

const KEY = 'diwaniya.data.v1';

/** On-device persistence (used when Firebase is not configured, and in tests). */
export class LocalRepository implements DataRepository {
  readonly kind = 'local' as const;
  private data: StoredData;
  private listeners = new Set<(d: StoredData) => void>();

  constructor(readonly userId = 'local', private storage: Storage | null = safeStorage()) {
    this.data = this.load();
  }

  private load(): StoredData {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return { ...EMPTY_DATA };
      const parsed = JSON.parse(raw) as Partial<StoredData>;
      return {
        transactions: parsed.transactions ?? [],
        categories: parsed.categories ?? [],
        recurring: parsed.recurring ?? [],
        openingBalance: parsed.openingBalance ?? null,
      };
    } catch {
      return { ...EMPTY_DATA };
    }
  }

  private commit(next: StoredData): Promise<void> {
    this.data = next;
    try {
      this.storage?.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota or private mode: keep in memory */
    }
    for (const l of this.listeners) l(this.data);
    return Promise.resolve();
  }

  subscribe(listener: (d: StoredData) => void): () => void {
    this.listeners.add(listener);
    listener(this.data);
    return () => this.listeners.delete(listener);
  }

  saveTransaction(tx: Transaction) {
    return this.saveTransactions([tx]);
  }

  saveTransactions(txs: Transaction[]) {
    const byId = new Map(this.data.transactions.map((t) => [t.id, t]));
    for (const tx of txs) byId.set(tx.id, tx);
    return this.commit({ ...this.data, transactions: [...byId.values()] });
  }

  deleteTransaction(id: string) {
    return this.commit({ ...this.data, transactions: this.data.transactions.filter((t) => t.id !== id) });
  }

  saveCategory(category: Category) {
    const rest = this.data.categories.filter((c) => c.id !== category.id);
    return this.commit({ ...this.data, categories: [...rest, category] });
  }

  saveRecurring(item: RecurringExpense) {
    const rest = this.data.recurring.filter((r) => r.id !== item.id);
    return this.commit({ ...this.data, recurring: [...rest, item] });
  }

  deleteRecurring(id: string) {
    return this.commit({ ...this.data, recurring: this.data.recurring.filter((r) => r.id !== id) });
  }

  saveOpeningBalance(opening: OpeningBalance | null) {
    return this.commit({ ...this.data, openingBalance: opening });
  }

  replaceAll(data: AppData) {
    return this.commit({
      transactions: [...data.transactions],
      categories: [...data.categories],
      recurring: [...data.recurring],
      openingBalance: data.openingBalance,
    });
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
