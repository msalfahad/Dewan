/**
 * Firestore persistence.
 *   users/{uid}/transactions/{id}   – ledger transactions (amounts in integer fils)
 *   users/{uid}/categories/{id}     – custom categories and overrides of default categories
 *   users/{uid}/recurring/{id}      – recurring expense templates
 *   users/{uid}/settings/account    – { openingBalance }
 * Running balances are never stored; they are derived by src/domain/ledger.ts.
 */
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch, getDocs, type Firestore } from 'firebase/firestore';
import type { AppData, Category, OpeningBalance, RecurringExpense, Transaction } from '../domain/types';
import { EMPTY_DATA, type DataRepository, type StoredData } from './repository';

export class FirebaseRepository implements DataRepository {
  readonly kind = 'firebase' as const;
  constructor(private db: Firestore, readonly userId: string) {}

  private col(name: 'transactions' | 'categories' | 'recurring') {
    return collection(this.db, 'users', this.userId, name);
  }

  private settingsDoc() {
    return doc(this.db, 'users', this.userId, 'settings', 'account');
  }

  subscribe(listener: (d: StoredData) => void): () => void {
    let state: StoredData = { ...EMPTY_DATA };
    const emit = (patch: Partial<StoredData>) => {
      state = { ...state, ...patch };
      listener(state);
    };
    const unsubs = [
      onSnapshot(this.col('transactions'), (s) => emit({ transactions: s.docs.map((d) => ({ ...(d.data() as Transaction), id: d.id })) })),
      onSnapshot(this.col('categories'), (s) => emit({ categories: s.docs.map((d) => ({ ...(d.data() as Category), id: d.id })) })),
      onSnapshot(this.col('recurring'), (s) => emit({ recurring: s.docs.map((d) => ({ ...(d.data() as RecurringExpense), id: d.id })) })),
      onSnapshot(this.settingsDoc(), (s) => emit({ openingBalance: (s.data()?.openingBalance as OpeningBalance | null | undefined) ?? null })),
    ];
    return () => unsubs.forEach((u) => u());
  }

  async saveTransaction(tx: Transaction) {
    await setDoc(doc(this.col('transactions'), tx.id), { ...tx, userId: this.userId });
  }

  async saveTransactions(txs: Transaction[]) {
    const batch = writeBatch(this.db);
    for (const tx of txs) batch.set(doc(this.col('transactions'), tx.id), { ...tx, userId: this.userId });
    await batch.commit();
  }

  async deleteTransaction(id: string) {
    await deleteDoc(doc(this.col('transactions'), id));
  }

  async saveCategory(category: Category) {
    await setDoc(doc(this.col('categories'), category.id), category);
  }

  async saveRecurring(item: RecurringExpense) {
    await setDoc(doc(this.col('recurring'), item.id), item);
  }

  async deleteRecurring(id: string) {
    await deleteDoc(doc(this.col('recurring'), id));
  }

  async saveOpeningBalance(opening: OpeningBalance | null) {
    await setDoc(this.settingsDoc(), { openingBalance: opening }, { merge: true });
  }

  async replaceAll(data: AppData) {
    for (const name of ['transactions', 'categories', 'recurring'] as const) {
      const snap = await getDocs(this.col(name));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(this.db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    const writes: Array<[string, string, object]> = [
      ...data.transactions.map((t) => ['transactions', t.id, { ...t, userId: this.userId }] as [string, string, object]),
      ...data.categories.map((c) => ['categories', c.id, c] as [string, string, object]),
      ...data.recurring.map((r) => ['recurring', r.id, r] as [string, string, object]),
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const [name, id, value] of writes.slice(i, i + 400)) batch.set(doc(this.db, 'users', this.userId, name, id), value);
      await batch.commit();
    }
    await this.saveOpeningBalance(data.openingBalance);
  }
}
