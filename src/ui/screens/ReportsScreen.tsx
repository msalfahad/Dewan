import { useMemo, useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { analyzeCategories } from '../../domain/analysis';
import { categoryName } from '../../domain/categories';
import { compareMonthKeys, shiftMonth } from '../../domain/dates';
import { buildReportModel, type ReportLanguage } from '../../pdf/reportModel';
import { monthName, translate } from '../../i18n/translate';
import { useI18n } from '../../i18n/I18nProvider';
import { BottomSheet } from '../components/BottomSheet';
import { CategoryDonut, MonthlyFlowChart } from '../components/Charts';
import { Stat } from '../components/common';
import { Icon } from '../components/Icon';
import { CategoryAnalysis } from './AnalysisScreen';
import { ReportPreview } from './ReportPreview';

function monthsBetween(from: string, to: string): string[] {
  const [a, b] = compareMonthKeys(from, to) <= 0 ? [from, to] : [to, from];
  const out: string[] = [];
  for (let m = a; m <= b && out.length < 120; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/**
 * Reports: choose a From/To period, then toggle individual months (one, several, non-consecutive,
 * across years), pick the report language (عربي / English / عربي + English), preview, print or create the PDF.
 */
export function ReportsScreen({ initialMonth }: { initialMonth: string }) {
  const { t, lang, month: monthText } = useI18n();
  const { ledger, categoriesById, openingBalance, today } = useAppData();
  const [from, setFrom] = useState(shiftMonth(initialMonth, -3));
  const [to, setTo] = useState(initialMonth);
  const range = useMemo(() => monthsBetween(from, to), [from, to]);
  const [months, setMonths] = useState<string[]>(range);
  const [language, setLanguage] = useState<ReportLanguage>(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const setRange = (f: string, tt: string) => {
    setFrom(f);
    setTo(tt);
    setMonths(monthsBetween(f, tt));
  };
  const toggle = (m: string) => setMonths((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort()));

  const input = { ledger, months, language, categoriesById, openingBalance, generatedOn: today };
  const model = useMemo(
    () => (months.length ? buildReportModel({ ledger, months, language, categoriesById, openingBalance, generatedOn: today }) : null),
    [ledger, months, language, categoriesById, openingBalance, today],
  );
  const period = model?.period;
  const outflowCats = useMemo(() => (period ? analyzeCategories(period.rows, categoriesById).outflow.filter((c) => c.paidFils > 0) : []), [period, categoriesById]);

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

  const print = () => {
    document.body.classList.add('printing-report');
    window.print();
    document.body.classList.remove('printing-report');
  };

  return (
    <div className="stack">
      <div className="range">
        <label>
          <Icon name="calendar" size={18} />
          <span>
            {t('reports.from')} {monthText(from)}
          </span>
          <input type="month" aria-label={t('reports.from')} value={from} onChange={(e) => e.target.value && setRange(e.target.value, to)} />
        </label>
        <label>
          <Icon name="calendar" size={18} />
          <span>
            {t('reports.to')} {monthText(to)}
          </span>
          <input type="month" aria-label={t('reports.to')} value={to} onChange={(e) => e.target.value && setRange(from, e.target.value)} />
        </label>
      </div>

      <div className="chips" role="group" aria-label={t('reports.selectMonths')}>
        {range.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={months.includes(m)} onClick={() => toggle(m)}>
            {monthName(lang, Number(m.slice(5)) - 1)}
            {range[0].slice(0, 4) !== range[range.length - 1].slice(0, 4) ? ` ${m.slice(0, 4)}` : ''}
          </button>
        ))}
      </div>

      {period ? (
        <>
          <div className="stat-duo report-head">
            <Stat big tone="inflow" icon="arrowOut" label={t('reports.totalInflow')} fils={period.inflowFils} />
            <Stat big tone="outflow" icon="arrowIn" label={t('reports.totalOutflow')} fils={period.outflowFils} />
          </div>
          <Stat big tone="net" icon="bars" label={t('reports.netFlow')} fils={period.inflowFils - period.outflowFils} />
          <div className="stat-duo report-balances">
            <Stat label={t('reports.openingBalance')} fils={period.openingFils} />
            <Stat label={t('reports.closingBalance')} fils={period.closingFils} />
            <Stat tone="due" icon="clock" label={t('reports.unpaidCommitments')} fils={period.unpaidFils} />
            <Stat label={t('reports.balanceAfterCommitments')} fils={period.balanceAfterCommitmentsFils} />
          </div>

          <div className="grid two">
          <div className="card">
            <h3 style={{ justifyContent: 'center' }}>{t('reports.periodChart')}</h3>
            <MonthlyFlowChart data={period.sections.map((s) => ({ month: s.month, inflowFils: s.inflowFils, outflowFils: s.outflowFils, dueFils: s.unpaidFils }))} />
          </div>
          {outflowCats.length > 0 && (
            <div className="card">
              <h3>{t('reports.outflowByCategory')}</h3>
              <CategoryDonut items={outflowCats.map((c) => ({ name: categoryName(c, lang), fils: c.paidFils }))} />
            </div>
          )}
          </div>
        </>
      ) : (
        <div className="warning">{t('reports.noMonths')}</div>
      )}

      <div className="card stack">
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
        <div className="stat-duo">
          <button type="button" className="btn outline-gold" disabled={!model} onClick={() => setPreview(true)}>
            <Icon name="eye" size={18} /> {t('reports.previewReport')}
          </button>
          <button type="button" className="btn outline-gold" disabled={!model || busy} onClick={() => void download()}>
            <Icon name="pdf" size={18} /> {busy ? t('reports.generating') : t('reports.createPdf')}
          </button>
        </div>
        {error && <div className="warning">{error}</div>}
      </div>

      {months.length > 0 && <CategoryAnalysis key={months.join(',')} months={months} />}

      {preview && model && (
        <BottomSheet title={t('reports.preview')} onClose={() => setPreview(false)} wide>
          <div className="row no-print" style={{ marginBottom: 12 }}>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void download()}>
              <Icon name="download" size={18} /> {t('reports.downloadPdf')}
            </button>
            <button type="button" className="btn" onClick={print}>
              <Icon name="print" size={18} /> {t('reports.print')}
            </button>
          </div>
          <ReportPreview model={model} />
        </BottomSheet>
      )}
    </div>
  );
}
