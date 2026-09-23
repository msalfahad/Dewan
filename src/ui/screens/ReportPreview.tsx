/**
 * HTML preview / print page of the report. Renders the same ReportModel as the PDF so what the
 * user previews is what the PDF contains. Printing uses repeating <thead> table headers.
 */
import { formatAmount } from '../../domain/money';
import type { ReportModel, Tone } from '../../pdf/reportModel';

const TONE: Record<Tone, string> = { gold: '#9A7A45', coral: '#D9534A', amber: '#C98A12', navy: '#0B1428', blue: '#5F7899' };
const PALETTE = ['#D9534A', '#B8955A', '#C98A12', '#5F7899', '#A3AAB5', '#C9B99A', '#8C7A5B'];

function Bars({ model }: { model: ReportModel }) {
  const rtl = model.dir === 'rtl';
  const bars = [
    { label: model.labels.inflow, v: model.charts.inflowFils, c: '#B8955A' },
    { label: model.labels.outflow, v: model.charts.outflowFils, c: '#D9534A' },
    { label: model.labels.due, v: model.charts.dueFils, c: '#C98A12' },
  ];
  const ordered = rtl ? [...bars].reverse() : bars;
  const max = Math.max(1, ...bars.map((b) => b.v));
  return (
    <svg viewBox="0 0 300 160" role="img" aria-label={model.labels.inflowVsOutflow}>
      {ordered.map((b, i) => {
        const h = (b.v / max) * 100;
        const x = 30 + i * 90;
        return (
          <g key={b.label}>
            <rect x={x} y={120 - h} width={50} height={h} fill={b.c} />
            <text x={x + 25} y={115 - h} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1B2233">
              {formatAmount(b.v)}
            </text>
            <text x={x + 25} y={136} textAnchor="middle" fontSize="9" fill="#5B6475">
              {b.label}
            </text>
          </g>
        );
      })}
      <line x1="10" x2="290" y1="120" y2="120" stroke="#D6CCB8" />
    </svg>
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
    const pos = pts.length === 1 ? 140 : 20 + (260 * i) / (pts.length - 1);
    return rtl ? 300 - pos : pos;
  };
  const y = (v: number) => 130 - ((v - min) / (max - min)) * 110;
  return (
    <svg viewBox="0 0 300 150" role="img" aria-label={model.labels.balanceTrend}>
      {[0, 1, 2, 3].map((g) => (
        <line key={g} x1="10" x2="290" y1={20 + g * 36.6} y2={20 + g * 36.6} stroke="#EFE7D6" />
      ))}
      <polyline fill="none" stroke="#B8955A" strokeWidth="2" points={pts.map((p, i) => `${x(i)},${y(p.balanceFils)}`).join(' ')} />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.balanceFils)} r="2.2" fill={p.balanceFils < 0 ? '#D9534A' : '#0B1428'} />
      ))}
      <text x={rtl ? 20 : 280} y="14" textAnchor={rtl ? 'start' : 'end'} fontSize="9" fontWeight="700" fill="#0B1428">
        {model.labels.balance}: {formatAmount(vals[vals.length - 1])}
      </text>
    </svg>
  );
}

function CategoryBars({ model }: { model: ReportModel }) {
  const cats = model.charts.categories.slice(0, 7);
  const max = Math.max(1, ...cats.map((c) => c.fils));
  return (
    <div>
      {cats.map((c, i) => (
        <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '38% 1fr', alignItems: 'center', gap: 6, fontSize: 10, margin: '3px 0' }}>
          <span>{c.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <i style={{ display: 'inline-block', height: 9, width: `${(c.fils * 70) / max}%`, background: PALETTE[i % PALETTE.length] }} />
            <span className="num">{formatAmount(c.fils)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Monthly({ model }: { model: ReportModel }) {
  const months = model.dir === 'rtl' ? [...model.charts.monthly].reverse() : model.charts.monthly;
  const max = Math.max(1, ...months.flatMap((m) => [m.inflowFils, m.outflowFils, m.dueFils]));
  const slot = 280 / Math.max(1, months.length);
  const bw = Math.min(14, (slot - 8) / 3);
  return (
    <svg viewBox="0 0 300 150" role="img" aria-label={model.labels.monthlyComparison}>
      {months.map((m, i) => {
        const cx = 10 + i * slot + slot / 2;
        const bars = [
          [m.inflowFils, '#B8955A'],
          [m.outflowFils, '#D9534A'],
          [m.dueFils, '#C98A12'],
        ] as const;
        return (
          <g key={m.label}>
            {bars.map(([v, c], j) => {
              const h = (v / max) * 105;
              return <rect key={j} x={cx - bw * 1.5 + j * bw} y={120 - h} width={bw - 1} height={h} fill={c} />;
            })}
            <text x={cx} y="134" textAnchor="middle" fontSize="8" fill="#5B6475">
              {m.label}
            </text>
          </g>
        );
      })}
      <line x1="10" x2="290" y1="120" y2="120" stroke="#D6CCB8" />
    </svg>
  );
}

export function ReportPreview({ model }: { model: ReportModel }) {
  return (
    <div className="report-paper print-area" dir={model.dir} lang={model.language === 'en' ? 'en' : 'ar'}>
      <div className="r-head">
        <div>
          <h2>{model.title}</h2>
          <div className="sub">{model.subtitle}</div>
          <small>{model.currencyNote}</small>
        </div>
        <div className="meta">
          <div>
            {model.generatedLabel}: {model.generatedValue}
          </div>
          <div style={{ color: '#D4B483', fontWeight: 700 }}>{model.monthsLabel}</div>
          <div>{model.monthsValue}</div>
        </div>
      </div>
      <div className="r-body">
        <div className="r-stats">
          {model.summary.map((s) => (
            <div key={s.label} style={{ ['--tone' as string]: TONE[s.tone] }}>
              <span>{s.label}</span>
              <b className="num">{s.value}</b>
            </div>
          ))}
        </div>

        <h4>{model.labels.visualSummary}</h4>
        <div className="r-charts">
          <div className="r-chart">
            <b>{model.labels.inflowVsOutflow}</b>
            <Bars model={model} />
          </div>
          <div className="r-chart">
            <b>{model.labels.balanceTrend}</b>
            <Trend model={model} />
          </div>
          <div className="r-chart">
            <b>{model.labels.byCategory}</b>
            <CategoryBars model={model} />
          </div>
          <div className="r-chart">
            <b>{model.labels.monthlyComparison}</b>
            <Monthly model={model} />
          </div>
        </div>

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

        <h4>{model.labels.detailedLedger}</h4>
        {model.sections.map((s) => (
          <section key={s.month} className="r-month">
            <h5>{s.title}</h5>
            <div className="r-stats">
              {s.stats.map((x) => (
                <div key={x.label} style={{ ['--tone' as string]: TONE[x.tone] }}>
                  <span>{x.label}</span>
                  <b className="num">{x.value}</b>
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
          {model.footer} · {model.generatedValue}
        </div>
      </div>
    </div>
  );
}
