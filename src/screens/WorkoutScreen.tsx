import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nowIso } from '../db/db';
import { bestSet, epley1RM, exerciseHistory, lastSessionSets, STRENGTH_DROP_PCT } from '../lib/calc';
import { formatDateLong, formatDayMonth } from '../lib/dates';
import type { Workout, WorkoutExercise, WorkoutSet } from '../lib/types';
import { navigate, useSettings } from '../hooks';
import { Button, Card, NumInput, TextInput, cx, haptic, parseNum, useToast } from '../components/ui';

const fmtSet = (s: WorkoutSet) => `${s.weight_kg}×${s.reps}${s.rpe != null ? ` @${s.rpe}` : ''}`;

export default function WorkoutScreen({ id }: { id?: string }) {
  const workout = useLiveQuery(async () => (id ? ((await db.workouts.get(id)) ?? null) : null), [id]);
  const all = useLiveQuery(() => db.workouts.toArray(), []);
  const settings = useSettings();
  const toast = useToast();
  const [newExercise, setNewExercise] = useState('');

  if (workout === null) return <p className="py-10 text-center text-muted">Workout not found.</p>;
  if (!workout || !all || !settings) return null;

  const save = (next: Workout) => db.workouts.put(next);
  const setExercises = (exercises: WorkoutExercise[]) => save({ ...workout, exercises });
  const knownNames = [...new Set(all.flatMap((w) => w.exercises.map((e) => e.name)))].sort();
  const cutStart = settings.profile.start_date;
  const others = all.filter((w) => w.id !== workout.id && w.date >= cutStart && w.date <= workout.date);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <input
            value={workout.name}
            onChange={(e) => save({ ...workout, name: e.target.value })}
            className="w-full bg-transparent text-2xl font-bold outline-none"
            aria-label="Workout name"
          />
          <div className="text-sm text-muted">
            {formatDateLong(workout.date)}
            {workout.finished_at ? ' · finished' : ' · in progress'}
          </div>
        </div>
        <a href="#/train" className="shrink-0 text-sm text-muted">
          Close
        </a>
      </header>

      {workout.exercises.map((ex, i) => (
        <ExerciseCard
          key={`${i}-${ex.name}`}
          exercise={ex}
          last={lastSessionSets(all.filter((w) => w.date <= workout.date), ex.name, workout.id)}
          cutBest={(() => {
            const h = exerciseHistory(others, ex.name);
            return h.length ? Math.max(...h.map((x) => x.best.e1rm)) : null;
          })()}
          onChange={(next) => setExercises(workout.exercises.map((e, j) => (j === i ? next : e)))}
          onRemove={() => {
            const prev = workout.exercises;
            setExercises(prev.filter((_, j) => j !== i));
            toast(`Removed ${ex.name}`, { label: 'Undo', run: () => db.workouts.update(workout.id, { exercises: prev }) });
          }}
        />
      ))}

      <Card>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newExercise.trim();
            if (!name) return;
            setExercises([...workout.exercises, { name, sets: [] }]);
            setNewExercise('');
          }}
        >
          <TextInput list="exercise-names" placeholder="Add exercise" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} aria-label="New exercise" />
          <datalist id="exercise-names">
            {knownNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button type="submit" disabled={!newExercise.trim()}>
            Add
          </Button>
        </form>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={async () => {
            if (!window.confirm('Delete this workout?')) return;
            await db.workouts.delete(workout.id);
            navigate('/train');
          }}
        >
          Delete
        </Button>
        {workout.finished_at ? (
          <Button className="flex-1" onClick={() => save({ ...workout, finished_at: null })}>
            Reopen
          </Button>
        ) : (
          <Button
            variant="primary"
            className="flex-1"
            onClick={async () => {
              await save({ ...workout, finished_at: nowIso() });
              toast('Workout saved');
              navigate('/');
            }}
          >
            Finish workout
          </Button>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  last,
  cutBest,
  onChange,
  onRemove,
}: {
  exercise: WorkoutExercise;
  last: ReturnType<typeof lastSessionSets>;
  cutBest: number | null;
  onChange: (e: WorkoutExercise) => void;
  onRemove: () => void;
}) {
  const suggest = (n: number): WorkoutSet | null => last?.sets[n] ?? exercise.sets[n - 1] ?? last?.sets[last.sets.length - 1] ?? null;
  const initial = suggest(exercise.sets.length);
  const [kg, setKg] = useState(initial ? String(initial.weight_kg) : '');
  const [reps, setReps] = useState(initial ? String(initial.reps) : '');
  const [rpe, setRpe] = useState('');
  const [editing, setEditing] = useState<number | null>(null);

  const w = parseNum(kg);
  const r = parseNum(reps);
  const valid = w != null && w >= 0 && r != null && r > 0 && Number.isInteger(r);
  const today = bestSet(exercise.sets);
  const dropPct = today && cutBest ? ((today.e1rm - cutBest) / cutBest) * 100 : null;
  const dropped = dropPct != null && dropPct < -STRENGTH_DROP_PCT;

  const loadForm = (s: WorkoutSet | null) => {
    setKg(s ? String(s.weight_kg) : '');
    setReps(s ? String(s.reps) : '');
    setRpe(s?.rpe != null ? String(s.rpe) : '');
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">{exercise.name}</h2>
        <button type="button" onClick={onRemove} className="min-h-8 px-2 text-sm text-muted" aria-label={`Remove ${exercise.name}`}>
          Remove
        </button>
      </div>
      <div className="mb-2 text-sm text-muted" data-testid="last-session">
        {last ? (
          <>
            Last ({formatDayMonth(last.date)}): <span className="tabular text-slate-200">{last.sets.map(fmtSet).join(', ')}</span>
          </>
        ) : (
          'No previous session'
        )}
      </div>

      {exercise.sets.length > 0 && (
        <ul className="mb-2 divide-y divide-line">
          {exercise.sets.map((s, i) => {
            const prev = last?.sets[i];
            const beat = prev ? epley1RM(s.weight_kg, s.reps) > epley1RM(prev.weight_kg, prev.reps) : false;
            return (
              <li key={i} className={cx('flex min-h-10 items-center gap-3', editing === i && 'text-accent')}>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    setEditing(i);
                    loadForm(s);
                  }}
                >
                  <span className="w-5 text-sm text-muted">{i + 1}</span>
                  <span className="tabular font-semibold">
                    {s.weight_kg} kg × {s.reps}
                  </span>
                  {s.rpe != null && <span className="text-sm text-muted">RPE {s.rpe}</span>}
                  {beat && <span className="text-xs text-accent">▲</span>}
                </button>
                <span className="tabular text-xs text-muted">e1RM {epley1RM(s.weight_kg, s.reps).toFixed(1)}</span>
                <button
                  type="button"
                  className="min-h-10 min-w-8 text-muted"
                  aria-label={`Delete set ${i + 1}`}
                  onClick={() => {
                    onChange({ ...exercise, sets: exercise.sets.filter((_, j) => j !== i) });
                    setEditing(null);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="grid grid-cols-[1fr_1fr_0.8fr_auto] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const set: WorkoutSet = { weight_kg: w!, reps: r!, rpe: parseNum(rpe) };
          if (editing != null) {
            onChange({ ...exercise, sets: exercise.sets.map((s, j) => (j === editing ? set : s)) });
            setEditing(null);
            loadForm(suggest(exercise.sets.length));
          } else {
            const sets = [...exercise.sets, set];
            onChange({ ...exercise, sets });
            haptic();
            const next = last?.sets[sets.length] ?? set;
            loadForm({ ...next, rpe: null });
          }
        }}
      >
        <NumInput value={kg} onChange={setKg} suffix="kg" aria-label={`${exercise.name} weight`} />
        <NumInput value={reps} onChange={setReps} suffix="reps" integer aria-label={`${exercise.name} reps`} />
        <NumInput value={rpe} onChange={setRpe} placeholder="RPE" aria-label={`${exercise.name} RPE`} />
        <Button type="submit" variant="primary" disabled={!valid} className="px-3">
          {editing != null ? 'Update' : 'Add set'}
        </Button>
      </form>

      {(today || cutBest) && (
        <div className={cx('mt-2 text-xs', dropped ? 'text-bad' : 'text-muted')}>
          e1RM today {today ? today.e1rm.toFixed(1) : '—'} kg · best this cut {cutBest ? cutBest.toFixed(1) : '—'} kg
          {dropPct != null && ` (${dropPct > 0 ? '+' : ''}${dropPct.toFixed(1)}%)`}
          {dropped && ' ⚠ down more than 5%'}
        </div>
      )}
    </Card>
  );
}
