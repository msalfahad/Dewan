/**
 * Dashboard/analysis charts. In Arabic the time axis runs right-to-left, the value axis sits on
 * the right and legends are right-aligned; in English the reverse.
 */
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAmount } from '../../domain/money';
import type { MonthlyFlow } from '../../domain/analysis';
import { useI18n } from '../../i18n/I18nProvider';
import { CHART } from '../theme';

const tooltipStyle = { background: '#111C36', border: '1px solid #2A3A63', borderRadius: 10, color: '#EDE6D6' };
/** Chart values stay in integer fils; ticks show whole dinars ("1,150"). */
const tick = (fils: number) => formatAmount(Math.trunc(fils / 1000) * 1000).replace(/\.\d{3}$/, '');

function useAxis() {
  const { isRtl, dir, money } = useI18n();
  return {
    reversed: isRtl,
    yOrientation: (isRtl ? 'right' : 'left') as 'right' | 'left',
    legendStyle: { direction: dir, textAlign: (isRtl ? 'right' : 'left') as 'right' | 'left', width: '100%' },
    legendAlign: (isRtl ? 'right' : 'left') as 'right' | 'left',
    tooltipFormatter: (v: unknown) => money(Number(v)),
  };
}

export function MonthlyFlowChart({ data }: { data: MonthlyFlow[] }) {
  const { t, month } = useI18n();
  const a = useAxis();
  const rows = data.map((d) => ({ name: month(d.month), inflow: d.inflowFils, outflow: d.outflowFils, due: d.dueFils }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" reversed={a.reversed} tick={{ fill: CHART.axis, fontSize: 11 }} />
          <YAxis orientation={a.yOrientation} tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={tick} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={a.tooltipFormatter} cursor={{ fill: 'rgba(212,180,131,0.06)' }} />
          <Legend align={a.legendAlign} wrapperStyle={a.legendStyle} />
          <Bar dataKey="inflow" name={t('types.inflow')} fill={CHART.inflow} radius={[4, 4, 0, 0]} />
          <Bar dataKey="outflow" name={t('types.outflow')} fill={CHART.outflow} radius={[4, 4, 0, 0]} />
          <Bar dataKey="due" name={t('status.due')} fill={CHART.due} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceTrendChart({ points }: { points: { label: string; balanceFils: number; description: string }[] }) {
  const { t } = useI18n();
  const a = useAxis();
  const rows = points.map((p, i) => ({ i: i + 1, name: p.label, balance: p.balanceFils, description: p.description }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" reversed={a.reversed} tick={{ fill: CHART.axis, fontSize: 10 }} minTickGap={24} />
          <YAxis orientation={a.yOrientation} tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={tick} width={56} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={a.tooltipFormatter}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { name: string; description: string } | undefined;
              return p ? `${p.name} — ${p.description}` : '';
            }}
          />
          <Legend align={a.legendAlign} wrapperStyle={a.legendStyle} />
          <Line type="monotone" dataKey="balance" name={t('columns.balance')} stroke={CHART.balance} strokeWidth={2.5} dot={{ r: 3, fill: CHART.inflow }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonut({ items }: { items: { name: string; fils: number }[] }) {
  const a = useAxis();
  const rows = items.map((i) => ({ name: i.name, value: i.fils }));
  return (
    <div className="chart-box">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="80%" paddingAngle={2} stroke="#0B1428">
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART.secondary[i % CHART.secondary.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={a.tooltipFormatter} />
          <Legend align={a.legendAlign} verticalAlign="bottom" wrapperStyle={a.legendStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
