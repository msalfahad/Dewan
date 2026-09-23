/**
 * HTML preview / print page of the report. Renders the same ReportModel as the PDF, in the same
 * design (white A4 paper, navy/gold header swoosh, icon cards, bars + donut, navy table header).
 * Printing uses repeating <thead> table headers.
 */
import { formatAmount, formatShare, shareTenthsOfPercent } from '../../domain/money';
import type { ReportModel, Tone } from '../../pdf/reportModel';
import { Icon } from '../components/Icon';

const TONE: Record<Tone, string> = { gold: '#9A7A45', green: '#1E9E5A', coral: '#D9534A', amber: '#C98A12', navy: '#0B1428', blue: '#5F7899' };
const DONUT = ['#3F6AA8', '#D9534A', '#B8955A', '#D4B483', '#A3AAB5', '#8C7A5B', '#7D8BA3', '#C98A12'];

function PeriodBars({ model }: { model: ReportModel }) {
  const rtl = model.dir === 'rtl';
  const months = rtl ? [...model.charts.monthly].reverse() : model.charts.monthly;
  const hasDue = months.some((m) => m.dueFils > 0);
  const max = Math.max(1, ...months.flatMap((m) => [m.inflowFils, m.outflowFils, m.dueFils]));
  const slot = 250 / Math.max(1, months.length);
  const series = hasDue ? 3 : 2;
  const bw = Math.min(16, (slot - 8) / series);
  const x0 = rtl ? 10 : 40;
  return (
    <svg viewBox="0 0 300 160" role="img" aria-label={model.labels.periodChart}>
      {[0, 1, 2, 3, 4].map((g) => {
        const y = 130 - g * 26;
        return (
          <g key={g}>
            <line x1={x0} x2={x0 + 250} y1={y} y2={y} stroke="#EFE7D6" />
            <text x={rtl ? 296 : 34} y={y + 3} textAnchor="end" fontSize="7" fill="#5B6475" direction="ltr">
              {formatAmount(Math.round((max * g) / 4)).replace(/\.\d{3}$/, '')}
            </text>
          </g>
        );
      })}
      {months.map((m, i) => {
        const cx = x0 + i * slot + slot / 2;
        const vals = [
          [m.inflowFils, '#1E9E5A'],
          [m.outflowFils, '#D9534A'],
          ...(hasDue ? [[m.dueFils, '#C98A12']] : []),
        ] as [number, string][];
        return (
          <g key={m.label}>
            {vals.map(([v, c], j) => {
              const h = (v / max) * 104;
              return <rect key={j} x={cx - (bw * series) / 2 + j * bw} y={130 - h} width={bw - 1} height={h} fill={c} />;
            })}
            <text x={cx} y="143" textAnchor="middle" fontSize="8" fill="#5B6475">
              {m.label.replace(/\s\d{4}$/, '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ model }: { model: ReportModel }) {
  const cats = model.charts.categories.slice(0, 7);
  const total = cats.reduce((s, c) => s + c.fils, 0);
  if (!total) return null;
  let a = 0;
  const seg = (a0: number, a1: number) => {
    const pt = (r: number, t: number) => `${60 + r * Math.sin(t)} ${60 - r * Math.cos(t)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${pt(52, a0)} A52 52 0 ${large} 1 ${pt(52, a1)} L${pt(30, a1)} A30 30 0 ${large} 0 ${pt(30, a0)} Z`;
  };
  return (
    <div className="r-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={model.labels.outflowByCategory} style={{ maxWidth: 150 }}>
        {cats.map((c, i) => {
          const sweep = Math.min((c.fils / total) * Math.PI * 2, Math.PI * 2 - 0.0001);
          const d = seg(a, a + sweep);
          a += sweep;
          return <path key={c.name} d={d} fill={DONUT[i % DONUT.length]} />;
        })}
        <text x="60" y="61" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0B1428" direction="ltr">
          {formatAmount(total)}
        </text>
        <text x="60" y="73" textAnchor="middle" fontSize="7" fill="#5B6475">
          {model.language === 'en' ? 'KWD' : 'د.ك'}
        </text>
      </svg>
      <ul>
        {cats.map((c, i) => (
          <li key={c.name}>
            <i style={{ background: DONUT[i % DONUT.length] }} />
            <span>{c.name}</span>
            <b className="num">{formatShare(shareTenthsOfPercent(c.fils, total))}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trend({ model }: { model: ReportModel }) {
  const pts = model.charts.trend;
  if (!pts.length) return null;
  const vals = pts.map((p) => p.balanceFils);
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals, min + 1);
  const rtl = model.dir === 'rtl';
  const x = (i: number) => {
    const pos = pts.length === 1 ? 150 : 20 + (260 * i) / (pts.length - 1);
    return rtl ? 300 - pos : pos;
  };
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 86;
  return (
    <svg viewBox="0 0 300 110" role="img" aria-label={model.labels.balanceTrend}>
      {[0, 1, 2, 3].map((g) => (
        <line key={g} x1="10" x2="290" y1={14 + g * 28.6} y2={14 + g * 28.6} stroke="#EFE7D6" />
      ))}
      <polyline fill="none" stroke="#B8955A" strokeWidth="2" points={pts.map((p, i) => `${x(i)},${y(p.balanceFils)}`).join(' ')} />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.balanceFils)} r="2.2" fill={p.balanceFils < 0 ? '#D9534A' : '#0B1428'} />
      ))}
    </svg>
  );
}

function InOut({ model }: { model: ReportModel }) {
  const bars = [
    { label: model.labels.inflow, v: model.charts.inflowFils, c: '#1E9E5A' },
    { label: model.labels.outflow, v: model.charts.outflowFils, c: '#D9534A' },
    { label: model.labels.due, v: model.charts.dueFils, c: '#C98A12' },
  ];
  const ordered = model.dir === 'rtl' ? [...bars].reverse() : bars;
  const max = Math.max(1, ...bars.map((b) => b.v));
  return (
    <svg viewBox="0 0 300 120" role="img" aria-label={model.labels.inflowVsOutflow}>
      {ordered.map((b, i) => {
        const h = (b.v / max) * 76;
        const x = 30 + i * 90;
        return (
          <g key={b.label}>
            <rect x={x} y={96 - h} width={50} height={h} fill={b.c} />
            <text x={x + 25} y={91 - h} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1B2233" direction="ltr">
              {formatAmount(b.v)}
            </text>
            <text x={x + 25} y={110} textAnchor="middle" fontSize="9" fill="#5B6475">
              {b.label}
            </text>
          </g>
        );
      })}
      <line x1="10" x2="290" y1="96" y2="96" stroke="#D6CCB8" />
    </svg>
  );
}

export function ReportPreview({ model }: { model: ReportModel }) {
  const rtl = model.dir === 'rtl';
  return (
    <div className="report-paper print-area" dir={model.dir} lang={model.language === 'en' ? 'en' : 'ar'}>
      <div className="r-head">
        <svg className="band" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true" style={rtl ? { left: 0, right: 'auto' } : { right: 0, left: 'auto', transform: 'scaleX(-1)' }}>
          <path d="M0 0 L380 0 C320 40 200 72 0 92 Z" fill="#0B1428" />
          <path d="M0 104 C180 88 320 50 400 0 L390 0 C310 46 175 82 0 97 Z" fill="#D4B483" />
          <path d="M0 110 C160 100 290 68 372 20 L370 24 C286 74 155 104 0 113 Z" fill="#B8955A" />
        </svg>
        <div className="brand">
          <span className="logo">
            <Icon name="diwan" size={34} />
          </span>
          <span>
            <b>{model.appName}</b>
            <small>{model.tagline}</small>
          </span>
        </div>
        <h2>{model.title}</h2>
        <div className="period">{model.monthsValue}</div>
        <div className="meta">
          {model.generatedLabel}: {model.generatedValue} · {model.currencyNote}
        </div>
      </div>
      <div className="r-body">
        <div className="r-stats">
          {model.headline.map((s) => (
            <div key={s.label} className={s.tone === 'coral' ? 'coral' : s.tone === 'green' ? 'green' : 'gold'} style={{ ['--tone' as string]: s.tone === 'navy' ? '#0B1428' : TONE[s.tone] }}>
              <span style={{ flex: 1 }}>
                <span>{s.label}</span>
                <b className="num">{s.value}</b>
              </span>
              <span style={{ color: s.tone === 'coral' ? '#D9534A' : s.tone === 'green' ? '#1E9E5A' : '#B8955A' }}>
                <Icon name={s.icon} size={26} />
              </span>
            </div>
          ))}
        </div>
        <div className="r-stats four">
          {model.balances.map((s) => (
            <div key={s.label} style={{ ['--tone' as string]: TONE[s.tone], borderInlineStart: `3px solid ${TONE[s.tone]}` }}>
              <span>
                <span>{s.label}</span>
                <b className="num">{s.value}</b>
              </span>
            </div>
          ))}
        </div>

        <div className="r-charts" style={{ marginTop: 12 }}>
          <div className="r-chart">
            <b>{model.labels.periodChart}</b>
            <div className="r-legend">
              <span>
                <i style={{ background: '#1E9E5A' }} />
                {model.labels.inflow}
              </span>
              <span>
                <i style={{ background: '#D9534A' }} />
                {model.labels.outflow}
              </span>
              {model.charts.monthly.some((m) => m.dueFils > 0) && (
                <span>
                  <i style={{ background: '#C98A12' }} />
                  {model.labels.due}
                </span>
              )}
            </div>
            <PeriodBars model={model} />
          </div>
          <div className="r-chart">
            <b>{model.labels.outflowByCategory}</b>
            <Donut model={model} />
          </div>
          <div className="r-chart">
            <b>{model.labels.balanceTrend}</b>
            <Trend model={model} />
          </div>
          <div className="r-chart">
            <b>{model.labels.inflowVsOutflow}</b>
            <InOut model={model} />
          </div>
        </div>

        {model.sections.length > 1 && (
          <>
            <h4>{model.labels.consolidated}</h4>
            <div className="r-table-wrap">
              <table className="r-table">
                <thead>
                  <tr>
                    {model.consolidated.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.consolidated.rows.map((r) => (
                    <tr key={r[0]}>
                      {r.map((c, i) => (
                        <td key={i} className={i ? 'n' : ''}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h4>{model.labels.transactionsDetail}</h4>
        {model.sections.map((s) => (
          <section key={s.month} className="r-month">
            <h5>{s.title}</h5>
            <div className="r-stats four">
              {s.stats.map((x) => (
                <div key={x.label} style={{ ['--tone' as string]: TONE[x.tone], borderInlineStart: `3px solid ${TONE[x.tone]}` }}>
                  <span>
                    <span>{x.label}</span>
                    <b className="num">{x.value}</b>
                  </span>
                </div>
              ))}
            </div>
            <div className="r-table-wrap" style={{ marginTop: 8 }}>
              <table className="r-table" data-testid={`report-table-${s.month}`}>
                <thead>
                  <tr>
                    {model.columns.map((c) => (
                      <th key={c.key} className={c.key === 'balance' ? 'bal' : ''}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.length === 0 && (
                    <tr>
                      <td colSpan={model.columns.length} style={{ textAlign: 'center' }}>
                        {s.emptyText}
                      </td>
                    </tr>
                  )}
                  {s.rows.map((r, i) => (
                    <tr key={i} className={r.kind === 'opening' ? 'opening' : r.isUnpaidOutflow ? 'unpaid' : ''}>
                      {model.columns.map((c) => {
                        const [first, ...rest] = r.cells[c.key];
                        const cls = [c.numeric ? 'n' : '', c.key === 'balance' ? 'bal' : '', c.key === 'inflow' ? 'in' : '', c.key === 'outflow' ? 'out' : ''].join(' ');
                        return (
                          <td key={c.key} className={cls}>
                            {first}
                            {rest.map((l, j) =>
                              c.numeric ? (
                                <small key={j}>{l}</small>
                              ) : (
                                <span key={j} className="l2">
                                  {l}
                                </span>
                              ),
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <div className="r-foot">
          <span>
            {model.labels.issuedOn}: {model.generatedValue}
          </span>
          <b style={{ color: '#B8955A' }}>{model.appName}</b>
        </div>
      </div>
    </div>
  );
}
