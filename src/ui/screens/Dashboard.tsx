import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { analyzeCategories, monthlyFlows } from '../../domain/analysis';
import { categoryName } from '../../domain/categories';
import { formatDateDMY } from '../../domain/dates';
import type { LedgerRow } from '../../domain/ledger';
import { buildMonthSection } from '../../domain/periods';
import { describe } from '../../domain/text';
import { useI18n } from '../../i18n/I18nProvider';
import { BalanceTrendChart, CategoryDonut, MonthlyFlowChart } from '../components/Charts';
import { EmptyState, Kpi } from '../components/common';
import { LedgerList } from './LedgerViews';
import { CHART } from '../theme';

export function Dashboard({ month, onOpen, onAdd, onViewLedger, onLoadDemo }: { month: string; onOpen: (r: LedgerRow) => void; onAdd: () => void; onViewLedger: () => void; onLoadDemo: () => void }) {
  const { t, lang, money, month: monthText } = useI18n();
  const { ledger, categoriesById, openingBalance } = useAppData();
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const s = ledger.summary;
  const section = useMemo(() => buildMonthSection(ledger, month), [ledger, month]);
  const scopedRows = scope === 'month' ? section.rows : ledger.rows;
  const flows = useMemo(() => monthlyFlows(ledger.rows).slice(-12), [ledger]);
  const analysis = useMemo(() => analyzeCategories(scopedRows, categoriesById), [scopedRows, categoriesById]);
  const trend = useMemo(
    () =>
      scopedRows.map((r) => ({
        label: formatDateDMY(r.date),
        balanceFils: r.balanceAfterFils,
        description: r.kind === 'opening' ? t('ledger.opening') : describe(r.transaction!, lang),
      })),
    [scopedRows, t, lang],
  );
  const latest = ledger.rows.slice(-6).reverse();

  if (ledger.rows.length === 0 && !openingBalance) {
    return (
      <div className="card">
        <EmptyState text={t('dashboard.empty')}>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn primary" onClick={onAdd}>
              {t('dashboard.addFirst')}
            </button>
            <button type="button" className="btn" onClick={onLoadDemo}>
              {t('dashboard.loadDemo')}
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const inflow = scope === 'month' ? section.inflowFils : s.totalInflowFils;
  const outflow = scope === 'month' ? section.outflowFils : s.totalOutflowFils;

  return (
    <div className="stack">
      <div className="grid kpis">
        <Kpi hero label={t('dashboard.currentBalance')} fils={s.currentBalanceFils} />
        <Kpi label={`${t('dashboard.totalInflow')}${scope === 'month' ? ` · ${monthText(month)}` : ''}`} fils={inflow} color={CHART.inflow} />
        <Kpi label={`${t('dashboard.totalOutflow')}${scope === 'month' ? ` · ${monthText(month)}` : ''}`} fils={outflow} color={CHART.outflow} />
        <Kpi label={t('dashboard.unpaidCommitments')} fils={s.unpaidCommitmentsFils} color={CHART.due} />
        <Kpi label={t('dashboard.balanceAfterCommitments')} fils={s.balanceAfterCommitmentsFils} color="#7189A8" hint={s.pendingInflowFils ? `${t('dashboard.pendingInflow')}: ${money(s.pendingInflowFils)}` : undefined} />
      </div>

      <div className="segmented" role="group">
        <button type="button" aria-pressed={scope === 'month'} onClick={() => setScope('month')}>
          {monthText(month)}
        </button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
          {t('common.allTime')}
        </button>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>{t('dashboard.monthlyChart')}</h3>
          <MonthlyFlowChart data={flows} />
        </div>
        <div className="card">
          <h3>{t('dashboard.categoryChart')}</h3>
          {analysis.outflow.some((c) => c.paidFils > 0) ? (
            <CategoryDonut items={analysis.outflow.filter((c) => c.paidFils > 0).map((c) => ({ name: `${c.icon} ${categoryName(c, lang)}`, fils: c.paidFils }))} />
          ) : (
            <EmptyState text={t('analysis.empty')} />
          )}
        </div>
      </div>

      <div className="card">
        <h3>
          {t('dashboard.balanceTrend')} <small className="muted">{t('dashboard.balanceTrendHint')}</small>
        </h3>
        <BalanceTrendChart points={trend} />
      </div>

      <div className="card">
        <h3>
          {t('dashboard.latest')}
          <button type="button" className="btn small ghost" onClick={onViewLedger}>
            {t('dashboard.viewAll')}
          </button>
        </h3>
        <LedgerList rows={latest} onOpen={onOpen} />
      </div>
    </div>
  );
}
