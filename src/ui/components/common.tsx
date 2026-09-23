import type { ReactNode } from 'react';
import type { Lang } from '../../config/app';
import { useI18n } from '../../i18n/I18nProvider';
import type { EffectiveStatus } from '../../domain/types';

/** Money in the active language: "950.000 د.ك" / "KWD 950.000". */
export function Money({ fils, className = '', signed = false }: { fils: number; className?: string; signed?: boolean }) {
  const { money } = useI18n();
  const text = money(fils);
  return <span className={`num ${className}`}>{signed && fils > 0 ? `+${text}` : text}</span>;
}

export function StatusBadge({ status }: { status: EffectiveStatus | 'opening' }) {
  const { t } = useI18n();
  return <span className={`badge ${status}`}>{t(`status.${status}`)}</span>;
}

export function Kpi({ label, fils, color, hero = false, hint }: { label: string; fils: number; color?: string; hero?: boolean; hint?: ReactNode }) {
  return (
    <div className={`card kpi ${hero ? 'hero' : ''}`} style={color ? ({ '--kpi': color } as React.CSSProperties) : undefined}>
      <div className="label">{label}</div>
      <div className="value" data-testid={`kpi-${label}`}>
        <Money fils={fils} />
      </div>
      {hint && <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{hint}</div>}
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
      <img src="./icons/icon.svg" alt="" />
      <p>{text}</p>
      {children}
    </div>
  );
}
