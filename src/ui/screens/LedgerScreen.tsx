import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { filteredTotals, filterLedgerRows, isFilterActive, type LedgerFilter } from '../../domain/filters';
import { transactionsBeforeOpening, type LedgerRow } from '../../domain/ledger';
import { translate } from '../../i18n/translate';
import { useI18n } from '../../i18n/I18nProvider';
import { EmptyState, Money } from '../components/common';
import { Icon } from '../components/Icon';
import { FilterPanel } from './FilterPanel';
import { LedgerList, LedgerTable } from './LedgerViews';

/** سجل حساب الديوان / Diwaniya Account Ledger — newest first, balance after every row. */
export function LedgerScreen({ filter, onFilter, onOpen, onAdd }: { filter: LedgerFilter; onFilter: (f: LedgerFilter) => void; onOpen: (row: LedgerRow) => void; onAdd: () => void }) {
  const { t } = useI18n();
  const { ledger, categoriesById, openingBalance, transactions } = useAppData();
  const [showFilters, setShowFilters] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);

  const rows = useMemo(
    () => filterLedgerRows(ledger.rows, filter, categoriesById, [translate('ar', 'ledger.opening'), translate('en', 'ledger.opening')]),
    [ledger, filter, categoriesById],
  );
  const totals = filteredTotals(rows);
  const ordered = newestFirst ? [...rows].reverse() : rows;
  const beforeOpening = transactionsBeforeOpening(openingBalance, transactions).length > 0;
  const active = isFilterActive(filter);

  return (
    <div className="stack">
      <div className="row">
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          <span className="sr-only">{t('common.search')}</span>
          <input type="search" className="input" placeholder={t('ledger.searchPlaceholder')} value={filter.search} onChange={(e) => onFilter({ ...filter, search: e.target.value })} />
        </label>
        <button type="button" className={`btn ${active ? 'primary' : ''}`} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <Icon name="filter" size={18} /> {t('common.filters')}
        </button>
        <div className="segmented" role="group">
          <button type="button" aria-pressed={newestFirst} onClick={() => setNewestFirst(true)}>
            ↓
          </button>
          <button type="button" aria-pressed={!newestFirst} onClick={() => setNewestFirst(false)}>
            ↑
          </button>
        </div>
      </div>
      {showFilters && <FilterPanel filter={filter} onChange={onFilter} />}

      {active && (
        <div className="totals-strip" aria-label={t('filters.active')}>
          <div>
            <span>{t('ledger.filteredInflow')}</span>
            <b className="pos">
              <Money fils={totals.inflowFils} />
            </b>
          </div>
          <div>
            <span>{t('ledger.filteredOutflow')}</span>
            <b className="coral">
              <Money fils={totals.outflowFils} />
            </b>
          </div>
          <div>
            <span>{t('ledger.filteredNet')}</span>
            <b>
              <Money fils={totals.netFils} signed />
            </b>
          </div>
          <div>
            <span>{t('ledger.filteredCount')}</span>
            <b className="num">{totals.count}</b>
          </div>
        </div>
      )}

      {beforeOpening && <div className="warning">{t('ledger.beforeOpeningWarning')}</div>}

      {ordered.length === 0 ? (
        <EmptyState text={t('ledger.empty')} />
      ) : (
        <>
          <div className="show-desktop">
            <LedgerTable rows={ordered} onOpen={onOpen} />
          </div>
          <div className="show-mobile">
            <LedgerList rows={ordered} onOpen={onOpen} />
          </div>
        </>
      )}

      <button type="button" className="btn wide" onClick={onAdd}>
        <Icon name="plusCircle" size={22} /> {t('home.addTransaction')}
      </button>
    </div>
  );
}
