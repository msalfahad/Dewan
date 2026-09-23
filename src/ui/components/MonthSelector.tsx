import { shiftMonth } from '../../domain/dates';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

/** Month stepper. "Previous" points toward the reading start (mirrors in RTL). */
export function MonthSelector({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const { t, month: label } = useI18n();
  return (
    <div className="month-selector">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label={t('common.previousMonth')}>
        <Icon name="prev" size={20} />
      </button>
      <input
        type="month"
        className="sr-only"
        aria-label={t('filters.months')}
        value={month}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
      <span className="label">{label(month)}</span>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} aria-label={t('common.nextMonth')}>
        <Icon name="next" size={20} />
      </button>
    </div>
  );
}
