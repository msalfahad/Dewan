/**
 * المصروفات (Expenses) and دفعات العائلة (Family Payments) screens, as in the design: two summary tiles,
 * status pills, a card per transaction (category tile, title, date, status, amount, balance) and an add button.
 */
import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { formatDateDMY, monthKeyOf } from '../../domain/dates';
import type { LedgerRow } from '../../domain/ledger';
import { describe } from '../../domain/text';
import type { EffectiveStatus, TransactionType } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { CategoryIcon } from '../components/CategoryIcon';
import { EmptyState, Money, Stat, StatusBadge } from '../components/common';
import { Icon } from '../components/Icon';

type Pill = 'all' | EffectiveStatus;

const PILLS: Record<TransactionType, Pill[]> = {
  outflow: ['all', 'due', 'paid', 'overdue'],
  inflow: ['all', 'received', 'pending'],
};

export function TxCard({ row, onOpen }: { row: LedgerRow; onOpen: (r: LedgerRow) => void }) {
  const { t, lang } = useI18n();
  const { categoriesById } = useAppData();
  const tx = row.transaction!;
  const cat = categoriesById.get(tx.categoryId);
  const isIn = tx.transactionType === 'inflow';
  return (
    <button type="button" className="tx-card" onClick={() => onOpen(row)}>
      <span className="tile">
        <CategoryIcon id={tx.categoryId} icon={cat?.icon} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="title" style={{ display: 'block' }}>
          {describe(tx, lang)}
        </span>
        <span className="meta">
          <span className="num">{formatDateDMY(tx.date)}</span>
          {tx.counterparty && <span>{tx.counterparty}</span>}
          <StatusBadge status={row.status} />
        </span>
      </span>
      <span className={`amount ${isIn ? 'in' : 'out'}`}>
        <Money fils={tx.amountFils} />
        <span className="bal">
          {t('columns.balance')}: <Money fils={row.balanceAfterFils} />
        </span>
      </span>
      <span className="chev">
        <Icon name="next" size={18} />
      </span>
    </button>
  );
}

export function TypeScreen({ type, month, onOpen, onAdd }: { type: TransactionType; month: string; onOpen: (r: LedgerRow) => void; onAdd: () => void }) {
  const { t } = useI18n();
  const { ledger } = useAppData();
  const [pill, setPill] = useState<Pill>('all');
  const [familyOnly, setFamilyOnly] = useState(true);

  const rows = useMemo(
    () =>
      ledger.rows.filter(
        (r) =>
          r.kind === 'transaction' &&
          r.transaction!.transactionType === type &&
          monthKeyOf(r.date) === month &&
          (type === 'outflow' || !familyOnly || r.transaction!.categoryId === 'in-family'),
      ),
    [ledger, type, month, familyOnly],
  );
  const visible = (pill === 'all' ? rows : rows.filter((r) => r.status === pill)).slice().reverse();
  const done = rows.filter((r) => r.applied).reduce((s, r) => s + r.transaction!.amountFils, 0);
  const open = rows.filter((r) => !r.applied).reduce((s, r) => s + r.transaction!.amountFils, 0);
  const isOut = type === 'outflow';

  return (
    <div className="stack">
      <div className="stat-duo">
        <Stat big tone={isOut ? 'outflow' : 'inflow'} icon="checkCircle" label={t(isOut ? 'status.paid' : 'status.received')} fils={done} />
        <Stat big tone="due" icon="clock" label={t(isOut ? 'status.due' : 'status.pending')} fils={open} />
      </div>

      {!isOut && (
        <div className="segmented" role="group">
          <button type="button" aria-pressed={familyOnly} onClick={() => setFamilyOnly(true)}>
            {t('family.title')}
          </button>
          <button type="button" aria-pressed={!familyOnly} onClick={() => setFamilyOnly(false)}>
            {t('family.allInflows')}
          </button>
        </div>
      )}

      <div className="pills" role="group" aria-label={t('filters.statuses')} style={{ gridTemplateColumns: `repeat(${PILLS[type].length}, 1fr)` }}>
        {PILLS[type].map((p) => (
          <button key={p} type="button" className={`pill ${p}`} aria-pressed={pill === p} onClick={() => setPill(p)}>
            {p === 'all' ? t('filters.all') : t(`status.${p}`)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState text={t(isOut ? 'expenses.empty' : 'family.empty')} />
      ) : (
        <div className="tx-list">
          {visible.map((r) => (
            <TxCard key={r.key} row={r} onOpen={onOpen} />
          ))}
        </div>
      )}

      <button type="button" className="btn wide" onClick={onAdd}>
        <Icon name="plusCircle" size={22} /> {t(isOut ? 'expenses.add' : 'family.add')}
      </button>
    </div>
  );
}
