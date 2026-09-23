import { useMemo } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { categoryName } from '../../domain/categories';
import { monthKeyOf, yearOf } from '../../domain/dates';
import { EMPTY_FILTER, type LedgerFilter, type StatusFilter } from '../../domain/filters';
import { OUTFLOW_PAYMENT_METHODS, type PaymentMethod, type TransactionType } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Chips } from '../components/common';

export interface FilterPanelOptions {
  showStatus?: boolean;
  showMethods?: boolean;
}

/** Filters: type, category, payment method, status (paid/due/overdue…), months (multi, cross-year), year. */
export function FilterPanel({ filter, onChange, options = {} }: { filter: LedgerFilter; onChange: (f: LedgerFilter) => void; options?: FilterPanelOptions }) {
  const { t, lang, month } = useI18n();
  const { categories, ledger } = useAppData();
  const months = useMemo(() => [...new Set(ledger.rows.map((r) => monthKeyOf(r.date)))].sort().reverse(), [ledger]);
  const years = useMemo(() => [...new Set(ledger.rows.map((r) => yearOf(r.date)))].sort().reverse(), [ledger]);
  const set = <K extends keyof LedgerFilter>(k: K, v: LedgerFilter[K]) => onChange({ ...filter, [k]: v });
  const statuses: StatusFilter[] = ['paid', 'due', 'overdue', 'received', 'pending'];
  const visibleCats = categories.filter((c) => !filter.types.length || filter.types.includes(c.kind));

  return (
    <div className="card stack">
      <Chips<TransactionType> label={t('filters.types')} value={filter.types} onChange={(v) => set('types', v)} options={[{ value: 'inflow', label: t('types.inflow') }, { value: 'outflow', label: t('types.outflow') }]} />
      <Chips<string> label={t('filters.categories')} value={filter.categoryIds} onChange={(v) => set('categoryIds', v)} options={visibleCats.map((c) => ({ value: c.id, label: `${c.icon} ${categoryName(c, lang)}` }))} />
      {options.showMethods !== false && (
        <Chips<PaymentMethod> label={t('filters.methods')} value={filter.paymentMethods} onChange={(v) => set('paymentMethods', v)} options={OUTFLOW_PAYMENT_METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) }))} />
      )}
      {options.showStatus !== false && (
        <Chips<StatusFilter> label={t('filters.statuses')} value={filter.statuses} onChange={(v) => set('statuses', v)} options={statuses.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
      )}
      <Chips<string> label={t('filters.years')} value={filter.years} onChange={(v) => set('years', v)} options={years.map((y) => ({ value: y, label: y }))} />
      <Chips<string> label={t('filters.months')} value={filter.months} onChange={(v) => set('months', v)} options={months.map((m) => ({ value: m, label: month(m) }))} />
      <div>
        <button type="button" className="btn small ghost" onClick={() => onChange({ ...EMPTY_FILTER, search: filter.search })}>
          {t('filters.reset')}
        </button>
      </div>
    </div>
  );
}
