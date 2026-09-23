import { createContext, useContext, type MouseEvent } from 'react';
import type { LedgerRow } from '../../domain/ledger';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

/** Edit / delete handlers for ledger rows, provided once by the shell. */
export interface RowActionHandlers {
  edit: (row: LedgerRow) => void;
  remove: (row: LedgerRow) => void;
}

export const RowActionsContext = createContext<RowActionHandlers | null>(null);

/** ✏️ تعديل / 🗑 حذف buttons shown directly on every transaction (and the opening balance). */
export function RowActionButtons({ row, compact = false }: { row: LedgerRow; compact?: boolean }) {
  const { t } = useI18n();
  const actions = useContext(RowActionsContext);
  if (!actions) return null;
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className={`row-actions ${compact ? 'compact' : ''}`}>
      <button type="button" className="act edit" onClick={stop(() => actions.edit(row))} aria-label={t('common.edit')}>
        <Icon name="edit" size={16} />
        {!compact && <span>{t('common.edit')}</span>}
      </button>
      <button type="button" className="act delete" onClick={stop(() => actions.remove(row))} aria-label={t('common.delete')}>
        <Icon name="trash" size={16} />
        {!compact && <span>{t('common.delete')}</span>}
      </button>
    </div>
  );
}
