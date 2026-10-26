import { daysBetween, formatDayMonth } from '../lib/dates';
import type { DatedValue, Trend } from '../lib/calc';
import type { WeightEntry } from '../lib/types';

const W = 360;
const H = 220;
const PAD = { l: 34, r: 10, t: 12, b: 24 };

/** Daily weigh-ins (dots), 7-day average (line), and a dashed projection to the goal end date. */
export default function WeightChart({
  weights,
  ma,
  trend,
  start,
  end,
  today,
}: {
  weights: WeightEntry[];
  ma: DatedValue[];
  trend: Trend | null;
  start: string;
  end: string;
  today: string;
}) {
  const values = [...weights.map((w) => w.weight_kg), ...(trend ? trend.line.map((p) => p.value) : [])];
  if (!values.length) return <p className="py-10 text-center text-sm text-muted">No weigh-ins yet.</p>;
  const lo = Math.floor(Math.min(...values) - 0.5);
  const hi = Math.ceil(Math.max(...values) + 0.5);
  const span = Math.max(daysBetween(start, end), 1);
  const x = (d: string) => PAD.l + (daysBetween(start, d) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const step = hi - lo > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weight chart">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#2a3542" strokeWidth={1} />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#8b98a8">
            {v}
          </text>
        </g>
      ))}
      {today >= start && today <= end && (
        <line x1={x(today)} x2={x(today)} y1={PAD.t} y2={H - PAD.b} stroke="#8b98a8" strokeDasharray="2 3" strokeWidth={1} />
      )}
      {[start, end].map((d, i) => (
        <text key={d} x={x(d)} y={H - 6} fontSize={10} fill="#8b98a8" textAnchor={i ? 'end' : 'start'}>
          {formatDayMonth(d)}
        </text>
      ))}
      {today > start && today < end && daysBetween(start, today) > span * 0.12 && daysBetween(today, end) > span * 0.12 && (
        <text x={x(today)} y={H - 6} fontSize={10} fill="#8b98a8" textAnchor="middle">
          today
        </text>
      )}
      {trend && (
        <line
          x1={x(trend.line[0].date)}
          y1={y(trend.line[0].value)}
          x2={x(trend.line[1].date)}
          y2={y(trend.line[1].value)}
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      )}
      {weights.map((w) => (
        <circle key={w.date} cx={x(w.date)} cy={y(w.weight_kg)} r={2.6} fill="#8b98a8" />
      ))}
      {ma.length > 1 && (
        <polyline
          points={ma.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
          fill="none"
          stroke="#4ade80"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
