import { useMemo } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { analyzeCategories, monthlyFlows, type MonthlyFlow } from '../../domain/analysis';
import { categoryName } from '../../domain/categories';
import { formatDateDMY, shiftMonth } from '../../domain/dates';
import type { LedgerRow } from '../../domain/ledger';
import { buildMonthSection } from '../../domain/periods';
import { describe } from '../../domain/text';
import { useI18n } from '../../i18n/I18nProvider';
import { BalanceTrendChart, CategoryDonut, MonthlyFlowChart } from '../components/Charts';
import { EmptyState, Money, Stat } from '../components/common';
import { Icon } from '../components/Icon';

/** Months ending at `month` (inclusive), oldest first, filled with zeros where there was no activity. */
export function flowWindow(rows: readonly LedgerRow[], month: string, size = 4): MonthlyFlow[] {
  const byMonth = new Map(monthlyFlows(rows).map((f) => [f.month, f]));
  return Array.from({ length: size }, (_, i) => shiftMonth(month, i - size + 1)).map((m) => byMonth.get(m) ?? { month: m, inflowFils: 0, outflowFils: 0, dueFils: 0 });
}

export function RecentList({ rows, onOpen }: { rows: LedgerRow[]; onOpen: (r: LedgerRow) => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="recent">
      {rows.map((r) => {
        const isIn = r.inflowFils > 0;
        const cls = !r.applied ? 'pending' : isIn ? 'in' : 'out';
        return (
          <button type="button" key={r.key} onClick={() => onOpen(r)}>
            <span className="d">
              {r.kind === 'opening' ? t('ledger.opening') : describe(r.transaction!, lang)}
              <small className="num">{formatDateDMY(r.date)}</small>
            </span>
            <span className={`a ${cls === 'out' ? 'coral' : cls === 'in' ? 'gold' : 'amber'}`}>
              <Money fils={isIn ? r.inflowFils : r.outflowFils} />
              <small>
                {t('columns.balance')}: <Money fils={r.balanceAfterFils} />
              </small>
            </span>
            <span className={`arrow ${cls}`}>
              <Icon name={isIn ? 'arrowIn' : 'arrowOut'} size={18} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Dashboard({ month, onOpen, onAdd, onViewLedger, onLoadDemo }: { month: string; onOpen: (r: LedgerRow) => void; onAdd: () => void; onViewLedger: () => void; onLoadDemo: () => void }) {
  const { t, lang } = useI18n();
  const { ledger, categoriesById, openingBalance } = useAppData();
  const s = ledger.summary;
  const section = useMemo(() => buildMonthSection(ledger, month), [ledger, month]);
  const flows = useMemo(() => flowWindow(ledger.rows, month), [ledger, month]);
  const analysis = useMemo(() => analyzeCategories(section.rows, categoriesById), [section, categoriesById]);
  const trend = useMemo(
    () =>
      ledger.rows.map((r) => ({
        label: formatDateDMY(r.date),
        balanceFils: r.balanceAfterFils,
        description: r.kind === 'opening' ? t('ledger.opening') : describe(r.transaction!, lang),
      })),
    [ledger, t, lang],
  );
  const latest = ledger.rows.slice(-5).reverse();

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

  const paidOutflow = analysis.outflow.filter((c) => c.paidFils > 0);

  return (
    <div className="stack">
      <div className="card hero">
        <div className="body">
          <div className="label">{t('dashboard.currentBalance')}</div>
          <div className="value" data-testid="current-balance">
            <Money fils={s.currentBalanceFils} />
          </div>
          <div className="sub">
            {t('dashboard.balanceAfterCommitments')}: <b><Money fils={s.balanceAfterCommitmentsFils} /></b>
          </div>
        </div>
        <span className="glyph">
          <Icon name="wallet" size={58} />
        </span>
      </div>

      <div className="stat-trio">
        <Stat tone="inflow" icon="arrowOut" label={t('dashboard.totalInflow')} fils={section.inflowFils} />
        <Stat tone="outflow" icon="arrowIn" label={t('dashboard.totalOutflow')} fils={section.outflowFils} />
        <Stat tone="due" icon="clock" label={t('dashboard.unpaidCommitments')} fils={s.unpaidCommitmentsFils} />
      </div>

      <div className="card">
        <h3 style={{ justifyContent: 'center' }}>{t('home.periodChart')}</h3>
        <MonthlyFlowChart data={flows} showDue={false} />
      </div>

      <div className="card">
        <h3>
          {t('home.recent')}
          <button type="button" className="link" onClick={onViewLedger}>
            {t('home.viewAll')}
          </button>
        </h3>
        <RecentList rows={latest} onOpen={onOpen} />
      </div>

      <button type="button" className="btn wide" onClick={onAdd}>
        <Icon name="plusCircle" size={22} /> {t('home.addTransaction')}
      </button>

      <div className="grid two">
        <div className="card">
          <h3>{t('dashboard.categoryChart')}</h3>
          {paidOutflow.length ? <CategoryDonut items={paidOutflow.map((c) => ({ name: categoryName(c, lang), fils: c.paidFils }))} /> : <EmptyState text={t('analysis.empty')} />}
        </div>
        <div className="card">
          <h3>
            {t('dashboard.balanceTrend')} <small className="muted">{t('dashboard.balanceTrendHint')}</small>
          </h3>
          <BalanceTrendChart points={trend} />
        </div>
      </div>
    </div>
  );
}
