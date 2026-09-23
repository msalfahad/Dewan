import type { ReactNode } from 'react';
import type { Lang } from '../../config/app';
import { useI18n } from '../../i18n/I18nProvider';
import type { EffectiveStatus } from '../../domain/types';
import { CURRENCY, formatAmount } from '../../domain/money';
import { Icon } from './Icon';

/**
 * Money in the active language: "950.000 د.ك" (Arabic, number then currency, read right-to-left)
 * or "KWD 950.000" (English). The currency is rendered smaller, as in the design.
 */
export function Money({ fils, className = '', signed = false }: { fils: number; className?: string; signed?: boolean }) {
  const { lang } = useI18n();
  const amount = `${signed && fils > 0 ? '+' : ''}${formatAmount(fils)}`;
  const amt = <span className="amt num">{amount}</span>;
  const cur = <span className="cur">{CURRENCY[lang]}</span>;
  return (
    <span className={`money ${className}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {lang === 'ar' ? (
        <>
          {amt} {cur}
        </>
      ) : (
        <>
          {cur} {amt}
        </>
      )}
    </span>
  );
}

export function StatusBadge({ status }: { status: EffectiveStatus | 'opening' }) {
  const { t } = useI18n();
  return <span className={`badge ${status}`}>{t(`status.${status}`)}</span>;
}

export type StatTone = 'inflow' | 'outflow' | 'due' | 'net' | 'plain';

/** Summary tile as in the design (gold inflow, coral outflow, amber due). */
export function Stat({ label, fils, tone = 'plain', icon, big = false, testId }: { label: string; fils: number; tone?: StatTone; icon?: string; big?: boolean; testId?: string }) {
  if (big) {
    return (
      <div className={`stat big ${tone}`}>
        {icon && (
          <span className="ico">
            <Icon name={icon} size={30} />
          </span>
        )}
        <div className="grow">
          <div className="label">{label}</div>
          <div className="value" data-testid={testId}>
            <Money fils={fils} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`stat ${tone}`}>
      <div className="label">
        {icon && (
          <span className="ico">
            <Icon name={icon} size={18} />
          </span>
        )}
        <span>{label}</span>
      </div>
      <div className="value" data-testid={testId}>
        <Money fils={fils} />
      </div>
    </div>
  );
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const opts: Lang[] = ['ar', 'en'];
  return (
    <div className="segmented" role="group" aria-label={t('lang.label')}>
      {opts.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>
          {compact ? (l === 'ar' ? 'ع' : 'EN') : t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label?: string }) {
  return (
    <div className="field">
      {label && <span>{label}</span>}
      <div className="chips">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="logo">
        <Icon name="diwan" size={48} />
      </div>
      <p>{text}</p>
      {children}
    </div>
  );
}
