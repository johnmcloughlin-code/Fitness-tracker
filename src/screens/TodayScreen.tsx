import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { logMealTemplate, setNotes, setSteps, setWeight, startWorkout } from '../db/actions';
import { macrosForGrams, scheduledTemplate, sumMacros } from '../lib/calc';
import { daysBetween, formatDateLong, toDateKey } from '../lib/dates';
import { navigate, useSettings, useToday } from '../hooks';
import { Bar, Button, Card, NumInput, SectionTitle, cx, parseNum, useToast } from '../components/ui';

export const EXPORT_REMINDER_DAYS = 7;

export default function TodayScreen() {
  const today = useToday();
  const settings = useSettings();
  const toast = useToast();
  const entries = useLiveQuery(() => db.food_entries.where('date').equals(today).toArray(), [today]);
  const weight = useLiveQuery(async () => (await db.weights.get(today)) ?? null, [today]);
  const steps = useLiveQuery(async () => (await db.steps.get(today)) ?? null, [today]);
  const note = useLiveQuery(async () => (await db.day_notes.get(today)) ?? null, [today]);
  const templates = useLiveQuery(() => db.workout_templates.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today]);
  const meals = useLiveQuery(() => db.meal_templates.orderBy('sort_order').toArray(), []);
  const foods = useLiveQuery(async () => new Map((await db.foods.toArray()).map((f) => [f.id, f])), []);

  if (!settings) return null;
  const { targets, goal } = settings;
  const totals = sumMacros(entries ?? []);
  const kcalLeft = targets.kcal - totals.kcal;
  const proteinLeft = targets.protein_g - totals.protein_g;
  const scheduled = templates ? scheduledTemplate(templates, today) : null;
  const openWorkout = workouts?.find((w) => !w.finished_at) ?? null;
  const doneWorkouts = workouts?.filter((w) => w.finished_at) ?? [];

  const lastExport = settings.last_full_export_at;
  const reference = lastExport ?? settings.installed_at;
  const exportStale = reference != null && daysBetween(toDateKey(new Date(reference)), today) > EXPORT_REMINDER_DAYS;

  return (
    <div className="space-y-4">
      {exportStale && (
        <a href="#/export" className="block rounded-2xl bg-warn/15 px-4 py-3 text-sm text-warn">
          {lastExport ? `Last full export was over ${EXPORT_REMINDER_DAYS} days ago.` : 'You have not made a full export yet.'} Tap to
          back up your data.
        </a>
      )}

      <header>
        <h1 className="text-2xl font-bold">Today</h1>
        <div className="text-sm text-muted">
          {formatDateLong(today)} · {Math.max(daysBetween(today, goal.end_date), 0)} days to go
        </div>
      </header>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className={cx('tabular text-4xl font-bold', kcalLeft < 0 ? 'text-bad' : 'text-slate-50')} data-testid="kcal-left">
              {Math.abs(kcalLeft)}
            </div>
            <div className="text-sm text-muted">{kcalLeft < 0 ? 'kcal over' : 'kcal left'}</div>
          </div>
          <div>
            <div className={cx('tabular text-4xl font-bold', proteinLeft <= 0 ? 'text-accent' : 'text-slate-50')} data-testid="protein-left">
              {Math.max(Math.round(proteinLeft), 0)}
              <span className="text-xl">g</span>
            </div>
            <div className="text-sm text-muted">protein to go</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Bar label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" />
          <Bar overIsGood label="Protein" value={totals.protein_g} target={targets.protein_g} unit="g" />
          <Bar label="Carbs" value={totals.carbs_g} target={targets.carbs_g} unit="g" />
          <Bar label="Fat" value={totals.fat_g} target={targets.fat_g} unit="g" />
        </div>
      </Card>

      <div className="space-y-3">
        {weight !== undefined && (
          <QuickNumber
            key={`w-${today}-${weight?.weight_kg ?? ''}`}
            label="Weight"
            suffix="kg"
            initial={weight?.weight_kg}
            hint="Morning"
            onSave={async (n) => {
              await setWeight(today, n);
              toast(`Weight saved: ${n} kg`);
            }}
            validate={(n) => n > 20 && n < 400}
          />
        )}
        {steps !== undefined && (
          <QuickNumber
            key={`s-${today}-${steps?.steps ?? ''}`}
            label="Steps"
            integer
            initial={steps?.steps}
            hint={`/ ${targets.steps.toLocaleString('en-GB')}`}
            onSave={async (n) => {
              await setSteps(today, Math.round(n));
              toast(`Steps saved: ${Math.round(n).toLocaleString('en-GB')}`);
            }}
            validate={(n) => n >= 0 && n < 200000}
          />
        )}
      </div>

      <Card>
        <SectionTitle right={<a href="#/train" className="text-sm text-accent">Cardio</a>}>Workout</SectionTitle>
        {openWorkout ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{openWorkout.name} in progress</div>
              <div className="text-sm text-muted">{openWorkout.exercises.reduce((a, e) => a + e.sets.length, 0)} sets logged</div>
            </div>
            <Button variant="primary" onClick={() => navigate(`/workout/${openWorkout.id}`)}>
              Continue
            </Button>
          </div>
        ) : doneWorkouts.length ? (
          <div className="flex items-center justify-between">
            <div className="font-semibold text-accent">✓ {doneWorkouts.map((w) => w.name).join(' + ')} done</div>
            <a href={`#/workout/${doneWorkouts[0].id}`} className="text-sm text-muted">
              View
            </a>
          </div>
        ) : scheduled ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold">{scheduled.name}</div>
              <div className="truncate text-sm text-muted">{scheduled.exercises.join(', ')}</div>
            </div>
            <Button variant="primary" onClick={async () => navigate(`/workout/${await startWorkout(today, scheduled)}`)}>
              Start
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-muted">Rest day</div>
            <a href="#/train" className="text-sm text-accent">
              Train anyway
            </a>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle right={<a href="#/food" className="text-sm text-accent">Food log</a>}>Quick-add meals</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {meals?.map((m) => {
            const kcal = foods
              ? sumMacros(m.items.map((i) => (foods.get(i.food_id) ? macrosForGrams(foods.get(i.food_id)!, i.grams) : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })))
              : null;
            return (
              <button
                type="button"
                key={m.id}
                className="min-h-14 rounded-xl bg-card2 px-3 py-2 text-left active:scale-[0.98]"
                onClick={async () => {
                  const added = await logMealTemplate(m, today);
                  toast(`Logged ${m.name}`, { label: 'Undo', run: () => db.food_entries.bulkDelete(added.map((e) => e.id)) });
                }}
              >
                <span className="block font-semibold">{m.name}</span>
                {kcal && (
                  <span className="tabular block text-xs text-muted">
                    {kcal.kcal} kcal · P {kcal.protein_g.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {note !== undefined && <NotesCard key={`${today}-${note?.notes ?? ''}`} initial={note?.notes ?? ''} onSave={(s) => setNotes(today, s)} />}
    </div>
  );
}

function QuickNumber({
  label,
  suffix,
  initial,
  hint,
  integer,
  onSave,
  validate,
}: {
  label: string;
  suffix?: string;
  initial?: number;
  hint?: string;
  integer?: boolean;
  onSave: (n: number) => Promise<void>;
  validate: (n: number) => boolean;
}) {
  const [v, setV] = useState(initial != null ? String(initial) : '');
  const n = parseNum(v);
  const ok = n != null && validate(n);
  const dirty = ok && n !== initial;
  return (
    <Card className="p-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) onSave(n!);
        }}
      >
        <div className="w-20 shrink-0">
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-muted">{initial != null && !dirty ? <span className="text-accent">✓ saved</span> : hint}</div>
        </div>
        <NumInput value={v} onChange={setV} suffix={suffix} integer={integer} aria-label={label} className="flex-1" />
        <Button type="submit" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} className="px-3">
          Save
        </Button>
      </form>
    </Card>
  );
}

function NotesCard({ initial, onSave }: { initial: string; onSave: (s: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Card>
      <SectionTitle>Notes</SectionTitle>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== initial && onSave(v)}
        rows={2}
        placeholder="Sleep, stress, anything unusual"
        className="w-full rounded-xl bg-card2 p-3 outline-none placeholder:text-muted/60"
        aria-label="Notes"
      />
    </Card>
  );
}
