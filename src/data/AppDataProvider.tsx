import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeCategories } from '../domain/categories';
import { todayIso } from '../domain/dates';
import { buildLedger, type Ledger } from '../domain/ledger';
import { indexCategories } from '../domain/text';
import type { Category, OpeningBalance, RecurringExpense, Transaction } from '../domain/types';
import { EMPTY_DATA, type DataRepository, type StoredData } from './repository';

export interface AppDataValue {
  repo: DataRepository;
  ready: boolean;
  transactions: Transaction[];
  categories: Category[];
  categoriesById: Map<string, Category>;
  recurring: RecurringExpense[];
  openingBalance: OpeningBalance | null;
  /** Full chronological ledger with the balance after every row (derived, never stored). */
  ledger: Ledger;
  today: string;
}

const Ctx = createContext<AppDataValue | null>(null);

export function AppDataProvider({ repo, children, today: fixedToday }: { repo: DataRepository; children: ReactNode; today?: string }) {
  const [data, setData] = useState<StoredData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = repo.subscribe((d) => {
      setData(d);
      setReady(true);
    });
    return unsub;
  }, [repo]);

  const today = fixedToday ?? todayIso();
  const value = useMemo<AppDataValue>(() => {
    const categories = mergeCategories(data.categories);
    return {
      repo,
      ready,
      transactions: data.transactions,
      categories,
      categoriesById: indexCategories(categories),
      recurring: [...data.recurring].sort((a, b) => a.createdAt - b.createdAt),
      openingBalance: data.openingBalance,
      ledger: buildLedger(data.openingBalance, data.transactions, today),
      today,
    };
  }, [data, repo, ready, today]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData must be used inside AppDataProvider');
  return v;
}
