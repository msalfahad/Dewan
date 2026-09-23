import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { monthKeyOf, yearOf } from '../../domain/dates';
import { buildReportModel, type ReportLanguage } from '../../pdf/reportModel';
import { monthName, translate } from '../../i18n/translate';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from '../components/Icon';
import { ReportPreview } from './ReportPreview';

/** Choose any months (one, several, non-consecutive, across years) and the report language, then preview / print / download PDF. */
export function ReportsScreen({ initialMonth }: { initialMonth: string }) {
  const { t, lang } = useI18n();
  const { ledger, categoriesById, openingBalance, today } = useAppData();
  const [months, setMonths] = useState<string[]>([initialMonth]);
  const [language, setLanguage] = useState<ReportLanguage>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set(ledger.rows.map((r) => yearOf(r.date)));
    set.add(yearOf(today));
    set.add(initialMonth.slice(0, 4));
    return [...set].sort().reverse();
  }, [ledger, today, initialMonth]);
  const active = useMemo(() => new Set(ledger.rows.map((r) => monthKeyOf(r.date))), [ledger]);

  const toggle = (m: string) => setMonths((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort()));
  const toggleYear = (y: string) => {
    const all = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).filter((m) => active.has(m));
    const on = all.length > 0 && all.every((m) => months.includes(m));
    setMonths((cur) => (on ? cur.filter((m) => !all.includes(m)) : [...new Set([...cur, ...all])].sort()));
  };

  const input = { ledger, months, language, categoriesById, openingBalance, generatedOn: today };
  const model = useMemo(() => (months.length ? buildReportModel({ ledger, months, language, categoriesById, openingBalance, generatedOn: today }) : null), [ledger, months, language, categoriesById, openingBalance, today]);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      // The PDF engine (pdf-lib + fontkit + font files) is loaded only when needed.
      const { downloadReportPdf } = await import('../../pdf/generate');
      await downloadReportPdf(input);
    } catch (e) {
      console.error(e);
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <h2 className="screen-title no-print">{t('reports.screenTitle')}</h2>
      <div className="card stack no-print">
        <h3>{t('reports.selectMonths')}</h3>
        {years.map((y) => (
          <div key={y} className="stack" style={{ gap: 6 }}>
            <div className="row">
              <b className="num">{y}</b>
              <button type="button" className="btn small ghost" onClick={() => toggleYear(y)}>
                {t('reports.selectYear')}
              </button>
            </div>
            <div className="chips">
              {Array.from({ length: 12 }, (_, i) => {
                const m = `${y}-${String(i + 1).padStart(2, '0')}`;
                return (
                  <button key={m} type="button" className="chip" aria-pressed={months.includes(m)} onClick={() => toggle(m)} style={active.has(m) ? undefined : { opacity: 0.55 }}>
                    {monthName(lang, i)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {months.length > 0 && (
          <button type="button" className="btn small ghost" onClick={() => setMonths([])}>
            {t('reports.clearSelection')}
          </button>
        )}

        <div className="field">
          <span>
            {t('reports.language')} / {translate(lang === 'ar' ? 'en' : 'ar', 'reports.language')}
          </span>
          <div className="segmented" role="radiogroup" aria-label={t('reports.language')}>
            {(['ar', 'en', 'both'] as ReportLanguage[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={language === l} aria-pressed={language === l} onClick={() => setLanguage(l)}>
                {t(l === 'ar' ? 'reports.langAr' : l === 'en' ? 'reports.langEn' : 'reports.langBoth')}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <button type="button" className="btn primary" disabled={!months.length || busy} onClick={() => void download()}>
            <Icon name="download" size={18} /> {busy ? t('reports.generating') : t('reports.downloadPdf')}
          </button>
          <button type="button" className="btn" disabled={!months.length} onClick={() => window.print()}>
            <Icon name="print" size={18} /> {t('reports.print')}
          </button>
        </div>
        {error && <div className="warning">{error}</div>}
      </div>

      {model ? (
        <>
          <h3 className="no-print" style={{ margin: 0 }}>
            {t('reports.preview')}
          </h3>
          <ReportPreview model={model} />
        </>
      ) : (
        <div className="warning">{t('reports.noMonths')}</div>
      )}
    </div>
  );
}
