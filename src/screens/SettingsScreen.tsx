import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, uid, wipeAll, ensureSeeded, nowIso } from '../db/db';
import { macrosForGrams, sumMacros } from '../lib/calc';
import { WEEKDAY_NAMES, parseUkDate, formatDate } from '../lib/dates';
import type { Food, Goal, MealTemplate, Profile, Targets, WorkoutTemplate } from '../lib/types';
import { useSettings } from '../hooks';
import { Button, Card, NumInput, SectionTitle, Select, Sheet, TextInput, cx, parseNum, useToast } from '../components/ui';
import { FoodForm, SLOT_OPTIONS, foodLabel } from '../components/food';

export default function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <TargetsCard key={JSON.stringify(settings.targets)} targets={settings.targets} />
      <ProfileCard key={JSON.stringify([settings.profile, settings.goal])} profile={settings.profile} goal={settings.goal} />
      <MealTemplatesCard />
      <WorkoutTemplatesCard />
      <FoodsCard />
      <DataCard />
    </div>
  );
}

const str = (n: number) => String(n);

function TargetsCard({ targets }: { targets: Targets }) {
  const toast = useToast();
  const [v, setV] = useState({ kcal: str(targets.kcal), protein_g: str(targets.protein_g), carbs_g: str(targets.carbs_g), fat_g: str(targets.fat_g), steps: str(targets.steps) });
  const parsed = Object.fromEntries(Object.entries(v).map(([k, s]) => [k, parseNum(s)])) as Record<keyof Targets, number | null>;
  const valid = Object.values(parsed).every((n) => n != null && n >= 0);
  const macroKcal = (parsed.protein_g ?? 0) * 4 + (parsed.carbs_g ?? 0) * 4 + (parsed.fat_g ?? 0) * 9;
  return (
    <Card>
      <SectionTitle>Daily targets</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Calories" suffix="kcal" integer value={v.kcal} onChange={(s) => setV({ ...v, kcal: s })} />
        <NumInput label="Steps" integer value={v.steps} onChange={(s) => setV({ ...v, steps: s })} />
        <NumInput label="Protein" suffix="g" value={v.protein_g} onChange={(s) => setV({ ...v, protein_g: s })} />
        <NumInput label="Carbs" suffix="g" value={v.carbs_g} onChange={(s) => setV({ ...v, carbs_g: s })} />
        <NumInput label="Fat" suffix="g" value={v.fat_g} onChange={(s) => setV({ ...v, fat_g: s })} />
        <div className="flex items-end pb-3 text-xs text-muted">Macros = {Math.round(macroKcal)} kcal</div>
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!valid}
        onClick={async () => {
          await setSetting('targets', parsed as Targets);
          toast('Targets saved');
        }}
      >
        Save targets
      </Button>
    </Card>
  );
}

function ProfileCard({ profile, goal }: { profile: Profile; goal: Goal }) {
  const toast = useToast();
  const [sex, setSex] = useState(profile.sex);
  const [age, setAge] = useState(str(profile.age_years));
  const [height, setHeight] = useState(str(profile.height_cm));
  const [startW, setStartW] = useState(str(profile.start_weight_kg));
  const [startD, setStartD] = useState(formatDate(profile.start_date));
  const [endD, setEndD] = useState(formatDate(goal.end_date));
  const [lossMin, setLossMin] = useState(str(goal.weekly_loss_min_kg));
  const [lossMax, setLossMax] = useState(str(goal.weekly_loss_max_kg));
  const nums = [age, height, startW, lossMin, lossMax].map(parseNum);
  const sd = parseUkDate(startD);
  const ed = parseUkDate(endD);
  const valid = nums.every((n) => n != null && n >= 0) && sd && ed && sd < ed;
  return (
    <Card>
      <SectionTitle>Profile & goal</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Sex" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        <NumInput label="Age" integer value={age} onChange={setAge} />
        <NumInput label="Height" suffix="cm" value={height} onChange={setHeight} />
        <NumInput label="Start weight" suffix="kg" value={startW} onChange={setStartW} />
        <TextInput label="Cut start (DD/MM/YYYY)" inputMode="numeric" value={startD} onChange={(e) => setStartD(e.target.value)} />
        <TextInput label="Cut end (DD/MM/YYYY)" inputMode="numeric" value={endD} onChange={(e) => setEndD(e.target.value)} />
        <NumInput label="Weekly loss min" suffix="kg" value={lossMin} onChange={setLossMin} />
        <NumInput label="Weekly loss max" suffix="kg" value={lossMax} onChange={setLossMax} />
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!valid}
        onClick={async () => {
          await setSetting('profile', { sex, age_years: nums[0]!, height_cm: nums[1]!, start_weight_kg: nums[2]!, start_date: sd! } satisfies Profile);
          await setSetting('goal', { type: 'cut', end_date: ed!, weekly_loss_min_kg: nums[3]!, weekly_loss_max_kg: nums[4]! } satisfies Goal);
          toast('Profile saved');
        }}
      >
        Save profile & goal
      </Button>
    </Card>
  );
}

// ---------- Meal templates ----------

function MealTemplatesCard() {
  const templates = useLiveQuery(() => db.meal_templates.orderBy('sort_order').toArray(), []);
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const [editing, setEditing] = useState<MealTemplate | null>(null);
  const byId = useMemo(() => new Map((foods ?? []).map((f) => [f.id, f])), [foods]);
  if (!templates || !foods) return null;
  return (
    <Card>
      <SectionTitle>Meal templates</SectionTitle>
      <ul className="divide-y divide-line">
        {templates.map((t) => {
          const m = sumMacros(t.items.filter((i) => byId.has(i.food_id)).map((i) => macrosForGrams(byId.get(i.food_id)!, i.grams)));
          return (
            <li key={t.id}>
              <button type="button" className="flex min-h-12 w-full items-center justify-between text-left" onClick={() => setEditing(t)}>
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="text-xs text-muted">{t.items.map((i) => `${i.grams} g ${byId.get(i.food_id)?.name ?? '?'}`).join(', ')}</span>
                </span>
                <span className="tabular shrink-0 pl-2 text-sm text-muted">{m.kcal} kcal</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-2 w-full"
        onClick={() => setEditing({ id: uid(), name: '', meal_slot: 'lunch', items: [], sort_order: (templates.at(-1)?.sort_order ?? 0) + 1 })}
      >
        + New meal template
      </Button>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Meal template">
        {editing && <MealTemplateEditor key={editing.id} template={editing} foods={foods} onDone={() => setEditing(null)} />}
      </Sheet>
    </Card>
  );
}

function MealTemplateEditor({ template, foods, onDone }: { template: MealTemplate; foods: Food[]; onDone: () => void }) {
  const [name, setName] = useState(template.name);
  const [slot, setSlot] = useState(template.meal_slot);
  const [items, setItems] = useState(template.items.map((i) => ({ food_id: i.food_id, grams: str(i.grams) })));
  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name));
  const options = sorted.map((f) => ({ value: f.id, label: foodLabel(f) }));
  const valid = name.trim() && items.length && items.every((i) => (parseNum(i.grams) ?? 0) > 0);
  return (
    <div className="space-y-3">
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Select label="Meal slot" value={slot} onChange={setSlot} options={SLOT_OPTIONS} />
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select value={it.food_id} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, food_id: v } : x)))} options={options} />
          </div>
          <NumInput className="w-24" suffix="g" value={it.grams} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, grams: v } : x)))} aria-label="Grams" />
          <button type="button" className="min-h-11 min-w-8 text-muted" aria-label="Remove item" onClick={() => setItems(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <Button className="w-full" onClick={() => setItems([...items, { food_id: sorted[0]?.id ?? '', grams: '100' }])} disabled={!sorted.length}>
        + Add food
      </Button>
      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={async () => {
            if (!window.confirm(`Delete template “${template.name || 'new'}”?`)) return;
            await db.meal_templates.delete(template.id);
            onDone();
          }}
        >
          Delete
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!valid}
          onClick={async () => {
            await db.meal_templates.put({ ...template, name: name.trim(), meal_slot: slot, items: items.map((i) => ({ food_id: i.food_id, grams: parseNum(i.grams)! })) });
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ---------- Workout templates ----------

function WorkoutTemplatesCard() {
  const templates = useLiveQuery(() => db.workout_templates.toArray(), []);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  if (!templates) return null;
  return (
    <Card>
      <SectionTitle>Workout templates</SectionTitle>
      <ul className="divide-y divide-line">
        {templates.map((t) => (
          <li key={t.id}>
            <button type="button" className="flex min-h-12 w-full flex-col justify-center text-left" onClick={() => setEditing(t)}>
              <span className="font-medium">
                {t.name} <span className="text-sm font-normal text-muted">({t.weekdays.map((d) => WEEKDAY_NAMES[d - 1]).join('/') || 'unscheduled'})</span>
              </span>
              <span className="text-xs text-muted">{t.exercises.join(', ')}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-2 w-full" onClick={() => setEditing({ id: uid(), name: '', weekdays: [], exercises: [] })}>
        + New workout template
      </Button>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Workout template">
        {editing && <WorkoutTemplateEditor key={editing.id} template={editing} others={templates.filter((t) => t.id !== editing.id)} onDone={() => setEditing(null)} />}
      </Sheet>
    </Card>
  );
}

function WorkoutTemplateEditor({ template, others, onDone }: { template: WorkoutTemplate; others: WorkoutTemplate[]; onDone: () => void }) {
  const [name, setName] = useState(template.name);
  const [days, setDays] = useState(template.weekdays);
  const [exercises, setExercises] = useState(template.exercises);
  const [newEx, setNewEx] = useState('');
  const taken = new Map(others.flatMap((t) => t.weekdays.map((d) => [d, t.name] as const)));
  const move = (i: number, d: number) => {
    const next = [...exercises];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setExercises(next);
  };
  return (
    <div className="space-y-3">
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div>
        <span className="mb-1 block text-xs text-muted">Scheduled days</span>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_NAMES.map((n, i) => {
            const d = i + 1;
            const on = days.includes(d);
            return (
              <button
                type="button"
                key={n}
                onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d].sort())}
                className={cx('min-h-11 rounded-lg text-xs font-semibold', on ? 'bg-accent text-accent-ink' : 'bg-card2 text-muted')}
                title={taken.has(d) ? `Also ${taken.get(d)}` : undefined}
              >
                {n}
              </button>
            );
          })}
        </div>
        {days.some((d) => taken.has(d)) && <p className="mt-1 text-xs text-warn">Some days are also used by another template; the first match is shown on Today.</p>}
      </div>
      <ul className="space-y-1">
        {exercises.map((e, i) => (
          <li key={i} className="flex items-center gap-1">
            <TextInput value={e} onChange={(ev) => setExercises(exercises.map((x, j) => (j === i ? ev.target.value : x)))} aria-label={`Exercise ${i + 1}`} />
            <button type="button" className="min-h-11 min-w-8 text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              ↑
            </button>
            <button type="button" className="min-h-11 min-w-8 text-muted disabled:opacity-30" disabled={i === exercises.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              ↓
            </button>
            <button type="button" className="min-h-11 min-w-8 text-muted" onClick={() => setExercises(exercises.filter((_, j) => j !== i))} aria-label="Remove">
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newEx.trim()) setExercises([...exercises, newEx.trim()]);
          setNewEx('');
        }}
      >
        <TextInput placeholder="Add exercise" value={newEx} onChange={(e) => setNewEx(e.target.value)} />
        <Button type="submit">Add</Button>
      </form>
      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={async () => {
            if (!window.confirm(`Delete template “${template.name || 'new'}”? Past workouts are kept.`)) return;
            await db.workout_templates.delete(template.id);
            onDone();
          }}
        >
          Delete
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!name.trim()}
          onClick={async () => {
            await db.workout_templates.put({ ...template, name: name.trim(), weekdays: days, exercises: exercises.map((e) => e.trim()).filter(Boolean) });
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ---------- Foods ----------

function FoodsCard() {
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Food | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!foods) return null;
  const term = q.trim().toLowerCase();
  const list = foods.filter((f) => !term || `${f.name} ${f.brand ?? ''} ${f.barcode ?? ''}`.toLowerCase().includes(term));
  const shown = showAll || term ? list : list.slice(0, 8);
  return (
    <Card>
      <SectionTitle>Foods ({foods.length})</SectionTitle>
      <TextInput placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search saved foods" />
      <ul className="mt-2 divide-y divide-line">
        {shown.map((f) => (
          <li key={f.id}>
            <button type="button" className="flex min-h-11 w-full items-center justify-between text-left" onClick={() => setEditing(f)}>
              <span className="min-w-0 truncate">{foodLabel(f)}</span>
              <span className="tabular shrink-0 pl-2 text-xs text-muted">
                {f.kcal_per_100g} kcal · {f.source === 'open_food_facts' ? 'OFF' : f.source}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!showAll && !term && list.length > 8 && (
        <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
          Show all {list.length}
        </Button>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit food">
        {editing && (
          <div className="space-y-3">
            <FoodForm
              key={editing.id}
              initial={editing}
              onSave={async (v) => {
                await db.foods.update(editing.id, { ...v, updated_at: nowIso() });
                setEditing(null);
              }}
            />
            <Button
              variant="danger"
              className="w-full"
              onClick={async () => {
                const used = (await db.meal_templates.toArray()).some((t) => t.items.some((i) => i.food_id === editing.id));
                if (used) return window.alert('This food is used in a meal template. Remove it from the template first.');
                if (!window.confirm(`Delete ${editing.name}? Logged entries keep their values.`)) return;
                await db.foods.delete(editing.id);
                setEditing(null);
              }}
            >
              Delete food
            </Button>
          </div>
        )}
      </Sheet>
    </Card>
  );
}

// ---------- Data ----------

function DataCard() {
  return (
    <Card className="space-y-2">
      <SectionTitle>Data</SectionTitle>
      <a href="#/export" className="flex min-h-11 items-center justify-center rounded-xl bg-card2 font-semibold">
        Export & import
      </a>
      <Button
        variant="danger"
        className="w-full"
        onClick={async () => {
          const answer = window.prompt('This permanently deletes everything on this phone and restores the starting setup. Type WIPE to confirm.');
          if (answer?.trim().toUpperCase() !== 'WIPE') return;
          await wipeAll();
          await ensureSeeded();
          window.location.hash = '/';
          window.location.reload();
        }}
      >
        Wipe all data
      </Button>
      <p className="text-xs text-muted">Data lives only on this phone (IndexedDB). Export a Full JSON regularly as a backup.</p>
    </Card>
  );
}
