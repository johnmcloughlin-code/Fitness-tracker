import { useLiveQuery } from 'dexie-react-hooks';
import { loadAll } from '../db/db';
import { adherence, clampRange, summariseDays } from '../lib/calc';
import { formatDayMonth, isoWeekLabel, startOfIsoWeek, weekdayShort } from '../lib/dates';
import { useToday } from '../hooks';
import { Card, cx } from '../components/ui';

function Pill({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <span
      title={label}
      className={cx(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold',
        ok == null ? 'bg-card2 text-muted/60' : ok ? 'bg-accent/20 text-accent' : 'bg-bad/15 text-bad',
      )}
    >
      {label}
    </span>
  );
}

export default function HistoryScreen() {
  const today = useToday();
  const data = useLiveQuery(loadAll, []);
  if (!data) return null;
  const firstData = [...data.weights, ...data.food_entries, ...data.workouts].map((r) => r.date).sort()[0];
  const start = firstData && firstData < data.profile.start_date ? firstData : data.profile.start_date;
  const days = summariseDays(data, clampRange(start, today)).reverse();
  const weeks = new Map<string, typeof days>();
  for (const d of days) {
    const k = startOfIsoWeek(d.date);
    weeks.set(k, [...(weeks.get(k) ?? []), d]);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>
      <p className="text-sm text-muted">
        K = kcal within ±100 · P = protein ≥ {data.targets.protein_g} g · W = scheduled workout done · S = steps ≥{' '}
        {data.targets.steps.toLocaleString('en-GB')}. Tap a day to see its food.
      </p>
      {[...weeks.entries()].map(([ws, ds]) => {
        const adh = ds.map((d) => adherence(d, data.targets));
        const pct = Math.round((adh.reduce((a, x) => a + x.hits, 0) / adh.reduce((a, x) => a + x.checks, 0)) * 100);
        return (
          <Card key={ws} className="py-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{isoWeekLabel(ws)}</span>
              <span className="text-muted">{pct}% adherence</span>
            </div>
            <ul className="divide-y divide-line">
              {ds.map((d, i) => {
                const a = adh[i];
                return (
                  <li key={d.date}>
                    <a href={`#/food?date=${d.date}`} className="flex min-h-12 items-center gap-2 py-1">
                      <span className="w-20 text-sm">
                        {weekdayShort(d.date)} {formatDayMonth(d.date)}
                      </span>
                      <span className="tabular flex-1 text-xs text-muted">
                        {d.food_logged ? `${d.kcal} kcal · P ${Math.round(d.protein_g)}` : 'no food'}
                        {d.weight_kg != null && ` · ${d.weight_kg.toFixed(1)} kg`}
                      </span>
                      <span className="flex gap-1">
                        <Pill ok={a.kcal_ok} label="K" />
                        <Pill ok={a.protein_ok} label="P" />
                        <Pill ok={a.workout_ok} label="W" />
                        <Pill ok={a.steps_ok} label="S" />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
