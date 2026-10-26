import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { setWeight } from '../db/actions';
import { averageInWindow, movingAverage, projectTrend, weeklyChange } from '../lib/calc';
import { formatDate, formatDateLong } from '../lib/dates';
import { useSettings, useToday } from '../hooks';
import { Button, Card, DateInput, NumInput, SectionTitle, parseNum, useToast } from '../components/ui';
import WeightChart from '../components/WeightChart';

const signed = (n: number, dp: number) => (n > 0 ? '+' : '') + n.toFixed(dp);

export default function WeightScreen() {
  const today = useToday();
  const settings = useSettings();
  const toast = useToast();
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), []);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  if (!settings || !weights) return null;
  const { goal, profile } = settings;
  const ma = movingAverage(weights);
  const avg7 = averageInWindow(weights, today);
  const wk = weeklyChange(weights, today);
  const trend = projectTrend(weights, today, goal.end_date);
  const n = parseNum(kg);
  const valid = n != null && n > 20 && n < 400 && date <= today;
  const chartStart = weights.length ? (weights[0].date < profile.start_date ? weights[0].date : profile.start_date) : profile.start_date;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Weight</h1>

      <Card>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            await setWeight(date, n!);
            toast(`Saved ${n} kg for ${formatDate(date)}`);
            setKg('');
          }}
        >
          <div className="min-w-0 flex-1">
            <DateInput label="Date" value={date} max={today} onChange={setDate} />
          </div>
          <div className="w-28">
            <NumInput label="Weight" suffix="kg" value={kg} onChange={setKg} placeholder={weights.find((w) => w.date === date)?.weight_kg.toFixed(1)} />
          </div>
          <Button type="submit" variant="primary" disabled={!valid}>
            Save
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="7-day average" value={avg7 != null ? `${avg7.toFixed(1)} kg` : '—'} />
        <Stat
          label="Weekly change"
          value={wk ? `${signed(wk.change_kg, 2)} kg` : '—'}
          sub={wk ? `${signed(wk.change_pct, 2)}% vs prior 7 days` : 'Needs 2 weeks of data'}
        />
        <Stat label="14-day trend" value={trend ? `${signed(trend.slope_kg_per_week, 2)} kg/wk` : '—'} sub={`Target −${goal.weekly_loss_min_kg}–${goal.weekly_loss_max_kg}`} />
        <Stat label={`Projected ${formatDate(goal.end_date)}`} value={trend ? `${trend.projected_kg.toFixed(1)} kg` : '—'} sub={`Start ${profile.start_weight_kg} kg`} />
      </div>

      <Card>
        <SectionTitle>Trend</SectionTitle>
        <WeightChart weights={weights} ma={ma} trend={trend} start={chartStart} end={goal.end_date} today={today} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted" />
            Daily
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-4 bg-accent align-middle" />
            7-day average
          </span>
          <span>
            <span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-warn align-middle" />
            Projection (last 14 days)
          </span>
        </div>
      </Card>

      <Card>
        <SectionTitle>Log</SectionTitle>
        <ul className="divide-y divide-line">
          {[...weights].reverse().map((w) => {
            const m = ma.find((p) => p.date === w.date);
            return (
              <li key={w.date} className="flex min-h-11 items-center justify-between gap-2 py-1">
                <span className="text-sm">{formatDateLong(w.date)}</span>
                <span className="tabular ml-auto font-semibold">{w.weight_kg.toFixed(1)}</span>
                <span className="tabular w-16 text-right text-xs text-muted">avg {m?.value.toFixed(1)}</span>
                <button
                  type="button"
                  className="min-h-11 min-w-11 text-muted"
                  aria-label={`Delete ${formatDate(w.date)}`}
                  onClick={async () => {
                    await db.weights.delete(w.date);
                    toast('Deleted', { label: 'Undo', run: () => db.weights.put(w) });
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}
