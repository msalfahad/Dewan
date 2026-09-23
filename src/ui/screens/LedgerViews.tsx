/** Ledger presentations: a full table (tablet/desktop) and a touch-friendly list (iPhone). Both always show the balance after each row. */
import { useAppData } from '../../data/AppDataProvider';
import { categoryName } from '../../domain/categories';
import { formatDateDMY } from '../../domain/dates';
import type { LedgerRow } from '../../domain/ledger';
import { formatAmount } from '../../domain/money';
import { describe, txCategory } from '../../domain/text';
import { useI18n } from '../../i18n/I18nProvider';
import { StatusBadge } from '../components/common';
import { Icon } from '../components/Icon';
import { RowActionButtons, RowActionsContext } from '../components/RowActions';
import { useContext } from 'react';

function useRowText() {
  const { t, lang } = useI18n();
  const { categoriesById, openingBalance } = useAppData();
  return (row: LedgerRow) => {
    if (row.kind === 'opening') {
      return {
        description: t('ledger.opening'),
        sub: openingBalance?.description ?? '',
        category: t('status.opening'),
        icon: '◆',
        counterparty: '—',
        method: '—',
      };
    }
    const tx = row.transaction!;
    const cat = txCategory(tx, categoriesById);
    return {
      description: describe(tx, lang),
      sub: '',
      category: categoryName(cat, lang),
      icon: cat.icon,
      counterparty: tx.counterparty || '—',
      method: tx.paymentMethod ? t(`methods.${tx.paymentMethod}`) : '—',
    };
  };
}

export function LedgerTable({ rows, onOpen }: { rows: LedgerRow[]; onOpen: (row: LedgerRow) => void }) {
  const { t } = useI18n();
  const withActions = useContext(RowActionsContext) !== null;
  const text = useRowText();
  return (
    <div className="ledger-table-wrap">
      <table className="ledger" aria-label={t('ledger.title')}>
        <thead>
          <tr>
            <th>{t('columns.date')}</th>
            <th>{t('columns.description')}</th>
            <th>{t('columns.category')}</th>
            <th>{t('columns.counterparty')}</th>
            <th>{t('columns.paymentMethod')}</th>
            <th className="amount">{t('columns.inflow')}</th>
            <th className="amount">{t('columns.outflow')}</th>
            {withActions && (
              <th>
                <span className="sr-only">{t('common.edit')}</span>
              </th>
            )}
            <th className="balance-col">{t('columns.balance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const x = text(row);
            return (
              <tr key={row.key} className={`clickable ${row.kind === 'opening' ? 'opening' : ''} ${row.applied ? '' : 'unapplied'}`} onClick={() => onOpen(row)} data-testid={`ledger-row-${row.key}`}>
                <td>
                  <span className="num">{formatDateDMY(row.date)}</span>
                </td>
                <td>
                  <div>{x.description}</div>
                  {!row.applied || row.status === 'overdue' ? <StatusBadge status={row.status} /> : null}
                  {x.sub && <div className="muted">{x.sub}</div>}
                </td>
                <td>
                  {x.icon} {x.category}
                </td>
                <td>{x.counterparty}</td>
                <td>{x.method}</td>
                <td className="amount pos">
                  <span className="num">{row.inflowFils ? formatAmount(row.inflowFils) : '—'}</span>
                </td>
                <td className={`amount ${row.applied ? 'coral' : 'amber'}`}>
                  <span className="num">{row.outflowFils ? formatAmount(row.outflowFils) : '—'}</span>
                </td>
                {withActions && (
                  <td className="actions-col">
                    <RowActionButtons row={row} compact />
                  </td>
                )}
                <td className="balance-col">
                  <span className="num" data-testid="row-balance">
                    {formatAmount(row.balanceAfterFils)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LedgerList({ rows, onOpen }: { rows: LedgerRow[]; onOpen: (row: LedgerRow) => void }) {
  const { t, money } = useI18n();
  const text = useRowText();
  return (
    <div className="ledger-list">
      {rows.map((row) => {
        const x = text(row);
        const isIn = row.inflowFils > 0;
        const amount = isIn ? row.inflowFils : row.outflowFils;
        return (
          <div key={row.key} className={`ledger-entry ${row.kind === 'opening' ? 'opening' : ''}`}>
            <button type="button" className={`ledger-item ${row.kind === 'opening' ? 'opening' : ''}`} onClick={() => onOpen(row)}>
            <span className={`dot ${!row.applied ? 'unapplied' : isIn ? 'inflow' : 'outflow'}`}>
              <Icon name={isIn ? 'arrowIn' : 'arrowOut'} size={18} />
            </span>
            <span className="main">
              <span className="desc" style={{ display: 'block' }}>
                {x.description}
              </span>
              <span className="sub">
                <span className="num">{formatDateDMY(row.date)}</span>
                <span>·</span>
                <span>{x.category}</span>
                {row.kind === 'transaction' && <span className={`badge ${isIn ? 'inflow' : 'outflow'}`}>{t(isIn ? 'types.inflow' : 'types.outflow')}</span>}
                {row.kind === 'transaction' && (!row.applied || row.status === 'overdue') && <StatusBadge status={row.status} />}
              </span>
            </span>
            <span className="side">
              <span className={`amt num ${!row.applied ? 'amber' : isIn ? 'pos' : 'coral'}`} style={{ display: 'block' }}>
                {isIn ? '+' : '−'}
                {formatAmount(amount)}
              </span>
              <span className="bal" style={{ display: 'block' }}>
                {t('columns.balance')}: <b className="num">{money(row.balanceAfterFils)}</b>
              </span>
            </span>
            </button>
            <RowActionButtons row={row} />
          </div>
        );
      })}
    </div>
  );
}
