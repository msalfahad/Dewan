import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { analyzeCategories, monthlyFlows, type CategoryTotal } from '../../domain/analysis';
import { categoryName } from '../../domain/categories';
import { EMPTY_FILTER, filterLedgerRows, type LedgerFilter } from '../../domain/filters';
import { formatShare } from '../../domain/money';
import { useI18n } from '../../i18n/I18nProvider';
import { CategoryDonut, MonthlyFlowChart } from '../components/Charts';
import { EmptyState, Kpi, Money } from '../components/common';
import { CHART } from '../theme';
import { FilterPanel } from './FilterPanel';

/** Payments by category: inflow/outflow totals, counts, share of outflow, paid vs unpaid, with filters. */
export function AnalysisScreen({ initialMonth }: { initialMonth: string }) {
  const { t, lang } = useI18n();
  const { ledger, categoriesById } = useAppData();
  const [filter, setFilter] = useState<LedgerFilter>({ ...EMPTY_FILTER, months: [initialMonth] });
  const rows = useMemo(() => filterLedgerRows(ledger.rows, filter, categoriesById), [ledger, filter, categoriesById]);
  const analysis = useMemo(() => analyzeCategories(rows, categoriesById), [rows, categoriesById]);
  const flows = useMemo(() => monthlyFlows(rows), [rows]);

  const list = (items: CategoryTotal[], kind: 'inflow' | 'outflow') => {
    const max = Math.max(1, ...items.map((i) => i.paidFils + i.unpaidFils));
    return items.map((c, idx) => (
      <div className="cat-row" key={c.categoryId}>
        <div>
          {c.icon} {categoryName(c, lang)}
        </div>
        <b className={kind === 'inflow' ? 'gold' : 'coral'}>
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
      <h2 className="screen-title">{t('analysis.title')}</h2>
      <FilterPanel filter={filter} onChange={setFilter} />
      <div className="grid kpis">
        <Kpi label={t('dashboard.totalInflow')} fils={analysis.totalInflowFils} color={CHART.inflow} />
        <Kpi label={t('analysis.totalPaid')} fils={analysis.totalPaidFils} color={CHART.outflow} />
        <Kpi label={t('analysis.totalDue')} fils={analysis.totalDueFils} color={CHART.due} />
      </div>
      {rows.length === 0 ? (
        <EmptyState text={t('analysis.empty')} />
      ) : (
        <>
          <div className="grid two">
            <div className="card">
              <h3>{t('analysis.outflowByCategory')}</h3>
              {analysis.outflow.some((c) => c.paidFils > 0) && <CategoryDonut items={analysis.outflow.filter((c) => c.paidFils > 0).map((c) => ({ name: categoryName(c, lang), fils: c.paidFils }))} />}
              {list(analysis.outflow, 'outflow')}
            </div>
            <div className="card">
              <h3>{t('analysis.inflowByCategory')}</h3>
              {list(analysis.inflow, 'inflow')}
            </div>
          </div>
          <div className="card">
            <h3>{t('dashboard.monthlyChart')}</h3>
            <MonthlyFlowChart data={flows} />
          </div>
        </>
      )}
    </div>
  );
}
