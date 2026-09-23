import { useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { formatDateDMY } from '../../domain/dates';
import type { LedgerRow } from '../../domain/ledger';
import { markAsPaid } from '../../domain/transactions';
import { INFLOW_PAYMENT_METHODS, OUTFLOW_PAYMENT_METHODS, type PaymentMethod } from '../../domain/types';
import { describe, txCategory } from '../../domain/text';
import { categoryName } from '../../domain/categories';
import { formatDateTime } from '../../i18n/translate';
import { useI18n } from '../../i18n/I18nProvider';
import { BottomSheet } from '../components/BottomSheet';
import { Money, StatusBadge } from '../components/common';
import { Icon } from '../components/Icon';

/** Full record view with the balance after this transaction, plus edit / delete / mark-paid. */
export function TransactionDetail({ row, onClose, onEdit, onToast }: { row: LedgerRow; onClose: () => void; onEdit: () => void; onToast: (m: string) => void }) {
  const { t, lang, longDate, month } = useI18n();
  const { repo, categoriesById, today, openingBalance } = useAppData();
  const [paying, setPaying] = useState(false);
  const [payDate, setPayDate] = useState(today);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const tx = row.transaction;

  if (row.kind === 'opening' || !tx) {
    return (
      <BottomSheet title={t('opening.title')} onClose={onClose}>
        <div className="balance-callout">
          <span>{t('ledger.balanceAfter')}</span>
          <b>
            <Money fils={row.balanceAfterFils} />
          </b>
        </div>
        <dl className="detail-list">
          <dt>{t('opening.amount')}</dt>
          <dd>
            <Money fils={row.inflowFils - row.outflowFils} />
          </dd>
          <dt>{t('opening.date')}</dt>
          <dd>{longDate(row.date)}</dd>
          {openingBalance?.description && (
            <>
              <dt>{t('opening.description')}</dt>
              <dd>{openingBalance.description}</dd>
            </>
          )}
        </dl>
        <p className="muted">{t('opening.hint')}</p>
      </BottomSheet>
    );
  }

  const cat = txCategory(tx, categoriesById);
  const unapplied = !row.applied;
  const methods = tx.transactionType === 'inflow' ? INFLOW_PAYMENT_METHODS : OUTFLOW_PAYMENT_METHODS;

  const remove = async () => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    await repo.deleteTransaction(tx.id);
    onToast(t('common.deleted'));
    onClose();
  };

  const confirmPaid = async () => {
    await repo.saveTransaction(markAsPaid(tx, payDate, payMethod));
    onToast(t('common.saved'));
    onClose();
  };

  return (
    <BottomSheet title={describe(tx, lang)} onClose={onClose}>
      <div className="balance-callout">
        <span>{t('ledger.balanceAfter')}</span>
        <b data-testid="detail-balance">
          <Money fils={row.balanceAfterFils} />
        </b>
      </div>
      {unapplied && <div className="warning" style={{ marginBottom: 12 }}>{t('ledger.notApplied')}</div>}
      <dl className="detail-list">
        <dt>{t('ledger.type')}</dt>
        <dd>
          <span className={`badge ${tx.transactionType}`}>{t(`types.${tx.transactionType}`)}</span> <StatusBadge status={row.status} />
        </dd>
        <dt>{t('ledger.amount')}</dt>
        <dd className={tx.transactionType === 'inflow' ? 'gold' : 'coral'}>
          <Money fils={tx.amountFils} />
        </dd>
        <dt>{t('columns.date')}</dt>
        <dd>
          {formatDateDMY(tx.date)} · {longDate(tx.date)}
        </dd>
        {tx.dueDate && tx.dueDate !== tx.date && (
          <>
            <dt>{t('ledger.dueDate')}</dt>
            <dd>{formatDateDMY(tx.dueDate)}</dd>
          </>
        )}
        <dt>{t('columns.description')}</dt>
        <dd>
          {describe(tx, lang)}
          {describe(tx, lang === 'ar' ? 'en' : 'ar') !== describe(tx, lang) && <div className="muted">{describe(tx, lang === 'ar' ? 'en' : 'ar')}</div>}
        </dd>
        <dt>{t('columns.category')}</dt>
        <dd>
          {cat.icon} {categoryName(cat, lang)}
        </dd>
        <dt>{t('columns.counterparty')}</dt>
        <dd>{tx.counterparty || '—'}</dd>
        <dt>{t('columns.paymentMethod')}</dt>
        <dd>{tx.paymentMethod ? t(`methods.${tx.paymentMethod}`) : '—'}</dd>
        {tx.salaryMonth && (
          <>
            <dt>{t('ledger.salaryMonth')}</dt>
            <dd>{month(tx.salaryMonth)}</dd>
          </>
        )}
        {tx.notes && (
          <>
            <dt>{t('ledger.notes')}</dt>
            <dd>{tx.notes}</dd>
          </>
        )}
        <dt>{t('ledger.sequence')}</dt>
        <dd className="num">#{row.sequence}</dd>
        <dt>{t('ledger.createdAt')}</dt>
        <dd>{formatDateTime(lang, tx.createdAt)}</dd>
        <dt>{t('ledger.updatedAt')}</dt>
        <dd>{formatDateTime(lang, tx.updatedAt)}</dd>
      </dl>

      {paying ? (
        <div className="card stack" style={{ marginTop: 14 }}>
          <div className="form-grid">
            <label className="field">
              <span>{tx.transactionType === 'inflow' ? t('ledger.receivedDate') : t('ledger.paymentDate')}</span>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('columns.paymentMethod')}</span>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {t(`methods.${m}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void confirmPaid()} disabled={!payDate}>
              <Icon name="check" size={18} /> {t('common.confirm')}
            </button>
            <button type="button" className="btn ghost" onClick={() => setPaying(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 16 }}>
          {unapplied && (
            <button type="button" className="btn primary" onClick={() => setPaying(true)}>
              <Icon name="check" size={18} /> {tx.transactionType === 'inflow' ? t('ledger.markReceived') : t('ledger.markPaid')}
            </button>
          )}
          <button type="button" className="btn" onClick={onEdit}>
            <Icon name="edit" size={18} /> {t('common.edit')}
          </button>
          <button type="button" className="btn danger" onClick={() => void remove()}>
            <Icon name="trash" size={18} /> {t('common.delete')}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
