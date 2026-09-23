import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { analyzeCategories, type CategoryTotal } from '../../domain/analysis';
import { categoryName } from '../../domain/categories';
import { EMPTY_FILTER, filterLedgerRows, isFilterActive, type LedgerFilter } from '../../domain/filters';
import { formatShare } from '../../domain/money';
import { useI18n } from '../../i18n/I18nProvider';
import { CategoryIcon } from '../components/CategoryIcon';
import { EmptyState, Money, Stat } from '../components/common';
import { Icon } from '../components/Icon';
import { CHART } from '../theme';
import { FilterPanel } from './FilterPanel';

/** Payments by category: inflow/outflow totals, counts, share of outflow, paid vs unpaid, with filters. */
export function CategoryAnalysis({ months }: { months: string[] }) {
  const { t, lang } = useI18n();
  const { ledger, categoriesById } = useAppData();
  const [filter, setFilter] = useState<LedgerFilter>({ ...EMPTY_FILTER, months });
  const [showFilters, setShowFilters] = useState(false);
  const rows = useMemo(() => filterLedgerRows(ledger.rows, filter, categoriesById), [ledger, filter, categoriesById]);
  const analysis = useMemo(() => analyzeCategories(rows, categoriesById), [rows, categoriesById]);

  const list = (items: CategoryTotal[], kind: 'inflow' | 'outflow') => {
    const max = Math.max(1, ...items.map((i) => i.paidFils + i.unpaidFils));
    if (!items.length) return <p className="muted">{t('analysis.empty')}</p>;
    return items.map((c, idx) => (
      <div className="cat-row" key={c.categoryId}>
        <span className="tile">
          <CategoryIcon id={c.categoryId} icon={c.icon} size={18} />
        </span>
        <div>{categoryName(c, lang)}</div>
        <b className={kind === 'inflow' ? 'pos' : 'coral'}>
          <Money fils={c.paidFils} />
        </b>
        <div className="cat-bar" aria-hidden="true">
          <i style={{ width: `${((c.paidFils + c.unpaidFils) * 100) / max}%`, background: kind === 'inflow' ? CHART.inflow : CHART.secondary[idx % CHART.secondary.length] }} />
        </div>
        <div className="cat-meta">
          <span>
            {t('analysis.count')}: <b className="num">{c.count}</b>
          </span>
          <span>
            {kind === 'outflow' ? t('analysis.share') : t('analysis.shareIn')}: <b className="num">{formatShare(c.shareTenths)}</b>
          </span>
          <span>
            {t('analysis.paid')}: <Money fils={c.paidFils} />
          </span>
          <span className="amber">
            {t('analysis.unpaid')}: <Money fils={c.unpaidFils} />
          </span>
        </div>
      </div>
    ));
  };

  return (
    <div className="stack">
      <div className="row">
        <h3 className="section-title" style={{ margin: 0, flex: 1 }}>
          {t('analysis.title')}
        </h3>
        <button type="button" className={`btn small ${isFilterActive({ ...filter, months: [] }) ? 'primary' : ''}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          <Icon name="filter" size={16} /> {t('common.filters')}
        </button>
      </div>
      {showFilters && <FilterPanel filter={filter} onChange={setFilter} />}
      <div className="stat-duo">
        <Stat tone="outflow" icon="checkCircle" label={t('analysis.totalPaid')} fils={analysis.totalPaidFils} />
        <Stat tone="due" icon="clock" label={t('analysis.totalDue')} fils={analysis.totalDueFils} />
      </div>
      {rows.length === 0 ? (
        <EmptyState text={t('analysis.empty')} />
      ) : (
        <div className="grid two">
          <div className="card">
            <h3>{t('analysis.outflowByCategory')}</h3>
            {list(analysis.outflow, 'outflow')}
          </div>
          <div className="card">
            <h3>{t('analysis.inflowByCategory')}</h3>
            {list(analysis.inflow, 'inflow')}
          </div>
        </div>
      )}
    </div>
  );
}
