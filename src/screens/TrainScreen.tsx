import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addCardio, startWorkout } from '../db/actions';
import { scheduledTemplate, strengthStatus } from '../lib/calc';
import { formatDateLong, formatDayMonth, WEEKDAY_NAMES } from '../lib/dates';
import type { CardioType } from '../lib/types';
import { navigate, useSettings, useToday } from '../hooks';
import { Button, Card, NumInput, SectionTitle, Segmented, cx, parseNum, useToast } from '../components/ui';

export const CARDIO_LABEL: Record<CardioType, string> = { bike: 'Bike', incline_walk: 'Incline walk' };

export default function TrainScreen() {
  const today = useToday();
  const settings = useSettings();
  const templates = useLiveQuery(() => db.workout_templates.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), []);
  const cardio = useLiveQuery(() => db.cardio.orderBy('date').reverse().limit(10).toArray(), []);
  if (!templates || !workouts || !settings) return null;

  const scheduled = scheduledTemplate(templates, today);
  const open = workouts.filter((w) => !w.finished_at);
  const start = async (t: (typeof templates)[number] | null) => navigate(`/workout/${await startWorkout(today, t)}`);
  const names = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name.trim())))].sort();
  const status = names
    .map((n) => ({ name: n, s: strengthStatus(workouts, n, settings.profile.start_date) }))
    .filter((x) => x.s);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Train</h1>

      {open.map((w) => (
        <Card key={w.id} className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{w.name} in progress</div>
            <div className="text-sm text-muted">{formatDateLong(w.date)}</div>
          </div>
          <Button variant="primary" onClick={() => navigate(`/workout/${w.id}`)}>
            Continue
          </Button>
        </Card>
      ))}

      <Card>
        <SectionTitle>Start a workout</SectionTitle>
        <div className="space-y-2">
          {[...templates]
            .sort((a, b) => (a.id === scheduled?.id ? -1 : b.id === scheduled?.id ? 1 : 0))
            .map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => start(t)}
                className={cx('flex min-h-14 w-full items-center justify-between rounded-xl px-3 py-2 text-left', t.id === scheduled?.id ? 'bg-accent text-accent-ink' : 'bg-card2')}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {t.name}
                    {t.id === scheduled?.id && ' · today'}
                  </span>
                  <span className={cx('block truncate text-xs', t.id === scheduled?.id ? 'text-accent-ink/80' : 'text-muted')}>
                    {t.weekdays.map((d) => WEEKDAY_NAMES[d - 1]).join('/')} · {t.exercises.length} exercises
                  </span>
                </span>
                <span className="font-semibold">Start</span>
              </button>
            ))}
          <Button className="w-full" onClick={() => start(null)}>
            Empty workout
          </Button>
        </div>
      </Card>

      <CardioCard today={today} />
      {cardio && cardio.length > 0 && (
        <Card>
          <SectionTitle>Recent cardio</SectionTitle>
          <ul className="divide-y divide-line">
            {cardio.map((c) => (
              <li key={c.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span className="shrink-0">{formatDayMonth(c.date)}</span>
                <span className="ml-auto">
                  {CARDIO_LABEL[c.type]} · {c.minutes} min
                  {c.avg_hr_bpm ? ` · ${c.avg_hr_bpm} bpm` : ''}
                  {c.kcal ? ` · ${c.kcal} kcal` : ''}
                </span>
                <button type="button" className="min-h-11 min-w-8 text-muted" aria-label="Delete cardio" onClick={() => db.cardio.delete(c.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {status.length > 0 && (
        <Card>
          <SectionTitle>Strength this cut (est. 1RM)</SectionTitle>
          <ul className="divide-y divide-line">
            {status.map(({ name, s }) => (
              <li key={name} className="flex min-h-10 items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{name}</span>
                <span className={cx('tabular shrink-0', s!.dropped ? 'text-bad' : 'text-muted')}>
                  {s!.latest_e1rm.toFixed(1)} / best {s!.best_e1rm.toFixed(1)} kg
                  {s!.dropped && ` ⚠ ${s!.change_pct.toFixed(1)}%`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>Recent sessions</SectionTitle>
        {workouts.length ? (
          <ul className="divide-y divide-line">
            {workouts.slice(0, 12).map((w) => (
              <li key={w.id}>
                <a href={`#/workout/${w.id}`} className="flex min-h-11 items-center justify-between text-sm">
                  <span>
                    {formatDayMonth(w.date)} · {w.name}
                  </span>
                  <span className="text-muted">{w.exercises.reduce((a, e) => a + e.sets.length, 0)} sets ›</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No workouts yet.</p>
        )}
      </Card>
    </div>
  );
}

function CardioCard({ today }: { today: string }) {
  const toast = useToast();
  const [type, setType] = useState<CardioType>('incline_walk');
  const [min, setMin] = useState('');
  const [hr, setHr] = useState('');
  const [kcal, setKcal] = useState('');
  const m = parseNum(min);
  return (
    <Card>
      <SectionTitle>Log cardio</SectionTitle>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!m || m <= 0) return;
          await addCardio({ date: today, type, minutes: Math.round(m), avg_hr_bpm: parseNum(hr), kcal: parseNum(kcal) });
          toast(`Logged ${Math.round(m)} min ${CARDIO_LABEL[type].toLowerCase()}`);
          setMin('');
          setHr('');
          setKcal('');
        }}
      >
        <Segmented value={type} onChange={setType} options={(['incline_walk', 'bike'] as const).map((v) => ({ value: v, label: CARDIO_LABEL[v] }))} />
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="Minutes" value={min} onChange={setMin} integer />
          <NumInput label="Avg HR (opt.)" value={hr} onChange={setHr} integer />
          <NumInput label="kcal (opt.)" value={kcal} onChange={setKcal} integer />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={!m || m <= 0}>
          Log cardio
        </Button>
      </form>
    </Card>
  );
}
