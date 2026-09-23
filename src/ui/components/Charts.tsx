/**
 * Dashboard/report charts. In Arabic the time axis runs right-to-left, the value axis sits on the
 * right and legends read from the right; in English the reverse. Values stay in integer fils.
 */
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAmount, formatShare, shareTenthsOfPercent } from '../../domain/money';
import type { MonthlyFlow } from '../../domain/analysis';
import { monthName } from '../../i18n/translate';
import { useI18n } from '../../i18n/I18nProvider';
import { CHART } from '../theme';
import { Money } from './common';

const tooltipStyle = { background: '#101A2D', border: '1px solid #2D4A78', borderRadius: 10, color: '#F5F1E8' };
/** Ticks show whole dinars ("1,200"). */
const tick = (fils: number) => formatAmount(Math.trunc(fils / 1000) * 1000).replace(/\.\d{3}$/, '');

function useAxis() {
  const { isRtl, money } = useI18n();
  return {
    reversed: isRtl,
    yOrientation: (isRtl ? 'right' : 'left') as 'right' | 'left',
    tooltipFormatter: (v: unknown) => money(Number(v)),
  };
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** "الوارد والصادر خلال الفترة": grouped monthly bars (gold inflow, coral outflow, amber due). */
export function MonthlyFlowChart({ data, showDue = true }: { data: MonthlyFlow[]; showDue?: boolean }) {
  const { t, lang } = useI18n();
  const a = useAxis();
  const hasDue = showDue && data.some((d) => d.dueFils > 0);
  const rows = data.map((d) => ({ name: monthName(lang, Number(d.month.slice(5)) - 1), inflow: d.inflowFils, outflow: d.outflowFils, due: d.dueFils }));
  return (
    <>
      <ChartLegend
        items={[
          { label: t('types.inflow'), color: CHART.inflow },
          { label: t('types.outflow'), color: CHART.outflow },
          ...(hasDue ? [{ label: t('status.due'), color: CHART.due }] : []),
        ]}
      />
      <div className="chart-box">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={3}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" reversed={a.reversed} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis orientation={a.yOrientation} tick={{ fill: CHART.axis, fontSize: 10 }} tickFormatter={tick} width={48} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={a.tooltipFormatter} cursor={{ fill: 'rgba(210,173,104,0.06)' }} />
            <Bar dataKey="inflow" name={t('types.inflow')} fill={CHART.inflow} radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="outflow" name={t('types.outflow')} fill={CHART.outflow} radius={[3, 3, 0, 0]} maxBarSize={22} />
            {hasDue && <Bar dataKey="due" name={t('status.due')} fill={CHART.due} radius={[3, 3, 0, 0]} maxBarSize={22} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function BalanceTrendChart({ points }: { points: { label: string; balanceFils: number; description: string }[] }) {
  const a = useAxis();
  const rows = points.map((p, i) => ({ i: i + 1, name: p.label, balance: p.balanceFils, description: p.description }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" reversed={a.reversed} tick={{ fill: CHART.axis, fontSize: 10 }} minTickGap={24} axisLine={false} tickLine={false} />
          <YAxis orientation={a.yOrientation} tick={{ fill: CHART.axis, fontSize: 10 }} tickFormatter={tick} width={52} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={a.tooltipFormatter}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { name: string; description: string } | undefined;
              return p ? `${p.name} — ${p.description}` : '';
            }}
          />
          <Line type="monotone" dataKey="balance" stroke={CHART.balance} strokeWidth={2.5} dot={{ r: 3, fill: CHART.inflow }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with the total in the centre and a legend with percentages (as in the design). */
export function CategoryDonut({ items }: { items: { name: string; fils: number }[] }) {
  const a = useAxis();
  const total = items.reduce((s, i) => s + i.fils, 0);
  const rows = items.map((i) => ({ name: i.name, value: i.fils }));
  return (
    <div className="donut-wrap">
      <div className="donut">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="92%" paddingAngle={1} stroke="#0A1020" startAngle={90} endAngle={-270} isAnimationActive={false}>
              {rows.map((_, i) => (
                <Cell key={i} fill={CHART.secondary[i % CHART.secondary.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={a.tooltipFormatter} />
          </PieChart>
        </ResponsiveContainer>
        <div className="center">
          <Money fils={total} />
        </div>
      </div>
      <ul className="legend">
        {items.map((i, idx) => (
          <li key={i.name}>
            <i style={{ background: CHART.secondary[idx % CHART.secondary.length] }} />
            <span>{i.name}</span>
            <span className="pct num">{formatShare(shareTenthsOfPercent(i.fils, total))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
