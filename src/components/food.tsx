import { lazy, Suspense, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { logFood, quickAdd, saveFoodDraft } from '../db/actions';
import { macrosForGrams, rescaleEntry } from '../lib/calc';
import { addDays, TIMEZONE } from '../lib/dates';
import { lookupBarcode, emptyDraft, type FoodDraft } from '../lib/off';
import { MEAL_SLOTS, type Food, type FoodEntry, type MealSlot } from '../lib/types';
import { useOnline } from '../hooks';
import { Button, NumInput, Select, Sheet, TextInput, parseNum, useToast } from './ui';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  evening: 'Evening',
};
export const SLOT_OPTIONS = MEAL_SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] }));

export function defaultSlot(now = new Date()): MealSlot {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(now)
    .split(':')
    .map(Number);
  const t = h + m / 60;
  if (t < 11) return 'breakfast';
  if (t < 15) return 'lunch';
  if (t < 17.5) return 'snack';
  if (t < 20.5) return 'dinner';
  return 'evening';
}

export function foodLabel(f: Pick<Food, 'name' | 'brand'>) {
  return f.brand ? `${f.name} · ${f.brand}` : f.name;
}

function MacroLine({ kcal, protein_g, carbs_g, fat_g }: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
  return (
    <span className="tabular text-sm text-muted">
      {Math.round(kcal)} kcal · P {protein_g.toFixed(0)} · C {carbs_g.toFixed(0)} · F {fat_g.toFixed(0)}
    </span>
  );
}

// ---------- Log a food ----------

export function FoodLogPanel({ food, date, onDone }: { food: Food; date: string; onDone: () => void }) {
  const toast = useToast();
  const [grams, setGrams] = useState(String(food.last_grams ?? 100));
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const g = parseNum(grams);
  const m = macrosForGrams(food, g ?? 0);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">{foodLabel(food)}</div>
        <div className="text-sm text-muted">
          per 100 g: {food.kcal_per_100g} kcal · P {food.protein_g_per_100g} · C {food.carbs_g_per_100g} · F {food.fat_g_per_100g}
          {food.barcode && ` · ${food.barcode}`}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Amount" suffix="g" value={grams} onChange={setGrams} autoFocus aria-label="Grams" />
        <Select label="Meal" value={slot} onChange={setSlot} options={SLOT_OPTIONS} />
      </div>
      <div className="rounded-xl bg-card2 p-3 text-center">
        <MacroLine {...m} />
      </div>
      <Button
        variant="primary"
        className="w-full"
        disabled={!g || g <= 0}
        onClick={async () => {
          await logFood(food, g!, date, slot);
          toast(`Logged ${food.name} (${m.kcal} kcal)`);
          onDone();
        }}
      >
        Log {g ? `${g} g` : ''}
      </Button>
    </div>
  );
}

// ---------- Create / edit a food ----------

export type FoodValues = Required<Pick<FoodDraft, 'name' | 'brand' | 'barcode'>> & {
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
};

export function FoodForm({
  initial,
  message,
  submitLabel = 'Save food',
  onSave,
}: {
  initial: Partial<FoodDraft>;
  message?: string;
  submitLabel?: string;
  onSave: (v: FoodValues) => void | Promise<void>;
}) {
  const s = (n: number | null | undefined) => (n == null ? '' : String(n));
  const [name, setName] = useState(initial.name ?? '');
  const [brand, setBrand] = useState(initial.brand ?? '');
  const [barcode, setBarcode] = useState(initial.barcode ?? '');
  const [kcal, setKcal] = useState(s(initial.kcal_per_100g));
  const [p, setP] = useState(s(initial.protein_g_per_100g));
  const [c, setC] = useState(s(initial.carbs_g_per_100g));
  const [f, setF] = useState(s(initial.fat_g_per_100g));
  const nums = [kcal, p, c, f].map(parseNum);
  const valid = name.trim() !== '' && nums.every((n) => n != null && n >= 0);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        await onSave({
          name: name.trim(),
          brand: brand.trim() || null,
          barcode: barcode.trim() || null,
          kcal_per_100g: nums[0]!,
          protein_g_per_100g: nums[1]!,
          carbs_g_per_100g: nums[2]!,
          fat_g_per_100g: nums[3]!,
        });
      }}
    >
      {message && <p className="rounded-xl bg-warn/15 p-3 text-sm text-warn">{message}</p>}
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <TextInput label="Barcode (optional)" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </div>
      <p className="text-xs text-muted">Values per 100 g</p>
      <div className="grid grid-cols-4 gap-2">
        <NumInput label="kcal" value={kcal} onChange={setKcal} />
        <NumInput label="Protein" value={p} onChange={setP} />
        <NumInput label="Carbs" value={c} onChange={setC} />
        <NumInput label="Fat" value={f} onChange={setF} />
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={!valid}>
        {submitLabel}
      </Button>
    </form>
  );
}

// ---------- Scan flow ----------

type ScanState =
  | { k: 'scan' }
  | { k: 'looking'; code: string }
  | { k: 'log'; food: Food }
  | { k: 'form'; draft: FoodDraft; message: string }
  | { k: 'offline'; code: string };

export function ScanSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Scan barcode">
      {open && <ScanFlow date={date} onDone={onClose} />}
    </Sheet>
  );
}

function ScanFlow({ date, onDone }: { date: string; onDone: () => void }) {
  const [state, setState] = useState<ScanState>({ k: 'scan' });
  const [manual, setManual] = useState('');
  const online = useOnline();

  async function handleCode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setState({ k: 'looking', code });
    const cached = await db.foods.where('barcode').equals(code).first();
    if (cached) return setState({ k: 'log', food: cached });
    const r = await lookupBarcode(code);
    switch (r.status) {
      case 'found':
        return setState({ k: 'log', food: await saveFoodDraft(r.draft, 'open_food_facts') });
      case 'incomplete':
        return setState({ k: 'form', draft: r.draft, message: 'Open Food Facts is missing some values for this product. Check the label and fill in the gaps.' });
      case 'not_found':
        return setState({ k: 'form', draft: r.draft, message: 'Not found on Open Food Facts. Create it from the label.' });
      case 'offline':
        return setState({ k: 'offline', code });
      case 'error':
        return setState({ k: 'form', draft: r.draft, message: `${r.message}. You can create it from the label.` });
    }
  }

  if (state.k === 'log') return <FoodLogPanel food={state.food} date={date} onDone={onDone} />;
  if (state.k === 'form')
    return (
      <FoodForm
        initial={state.draft}
        message={state.message}
        submitLabel="Save and continue"
        onSave={async (v) => setState({ k: 'log', food: await saveFoodDraft(v, 'custom') })}
      />
    );
  if (state.k === 'offline')
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-warn/15 p-3 text-sm text-warn" role="alert">
          You're offline and barcode {state.code} isn't saved on this phone yet. Scan it again when you're back online, or create
          it now from the label.
        </p>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => setState({ k: 'form', draft: emptyDraft(state.code), message: 'Offline: enter the values from the label.' })}
        >
          Create custom food
        </Button>
        <Button className="w-full" onClick={() => setState({ k: 'scan' })}>
          Scan another
        </Button>
      </div>
    );
  return (
    <div className="space-y-4">
      {state.k === 'looking' ? (
        <p className="py-10 text-center text-muted">Looking up {state.code}…</p>
      ) : (
        <Suspense fallback={<div className="aspect-[4/3] w-full rounded-2xl bg-black" />}>
          <BarcodeScanner onDetected={handleCode} />
        </Suspense>
      )}
      {!online && <p className="text-center text-sm text-warn">Offline: only foods already saved on this phone can be found.</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleCode(manual);
        }}
      >
        <TextInput
          inputMode="numeric"
          placeholder="Or type the barcode"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
          aria-label="Barcode"
        />
        <Button type="submit" variant="primary" disabled={!manual}>
          Find
        </Button>
      </form>
    </div>
  );
}

// ---------- Search saved & recent foods ----------

export function SearchSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const recentIds = useLiveQuery(async () => {
    const entries = await db.food_entries.where('date').aboveOrEqual(addDays(date, -30)).toArray();
    entries.sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    return [...new Set(entries.map((e) => e.food_id).filter((x): x is string => !!x))];
  }, [date]);

  const list = useMemo(() => {
    if (!foods) return [];
    const rank = new Map((recentIds ?? []).map((id, i) => [id, i]));
    const term = q.trim().toLowerCase();
    const matches = term
      ? foods.filter((f) => `${f.name} ${f.brand ?? ''} ${f.barcode ?? ''}`.toLowerCase().includes(term))
      : foods.filter((f) => rank.has(f.id));
    return matches
      .sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [foods, recentIds, q]);

  const close = () => {
    setPicked(null);
    setCreating(false);
    setQ('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={picked ? 'Log food' : creating ? 'New food' : 'Find food'}>
      {picked ? (
        <FoodLogPanel food={picked} date={date} onDone={close} />
      ) : creating ? (
        <FoodForm
          initial={{ name: q }}
          submitLabel="Save and continue"
          onSave={async (v) => {
            setPicked(await saveFoodDraft(v, 'custom'));
            setCreating(false);
          }}
        />
      ) : (
        <div className="space-y-3">
          <TextInput placeholder="Search saved foods" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search foods" />
          {!q && <p className="text-xs uppercase tracking-wide text-muted">Recent</p>}
          <ul className="divide-y divide-line">
            {list.map((f) => (
              <li key={f.id}>
                <button type="button" className="flex min-h-12 w-full items-center justify-between py-2 text-left" onClick={() => setPicked(f)}>
                  <span>
                    <span className="block">{foodLabel(f)}</span>
                    <span className="text-xs text-muted">
                      {f.kcal_per_100g} kcal · P {f.protein_g_per_100g} / 100 g
                    </span>
                  </span>
                  <span className="text-sm text-muted">{f.last_grams ? `${f.last_grams} g` : ''}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="py-4 text-center text-sm text-muted">{q ? 'No matches.' : 'Nothing logged recently. Search all saved foods above.'}</li>}
          </ul>
          <Button className="w-full" onClick={() => setCreating(true)}>
            + New custom food
          </Button>
        </div>
      )}
    </Sheet>
  );
}

// ---------- Quick add ----------

export function QuickAddSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const k = parseNum(kcal);
  return (
    <Sheet open={open} onClose={onClose} title="Quick add">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (k == null) return;
          await quickAdd(date, slot, name, { kcal: Math.round(k), protein_g: parseNum(p) ?? 0, carbs_g: parseNum(c) ?? 0, fat_g: parseNum(f) ?? 0 });
          toast(`Added ${Math.round(k)} kcal`);
          setName('');
          setKcal('');
          setP('');
          setC('');
          setF('');
          onClose();
        }}
      >
        <TextInput label="Label (optional)" placeholder="Quick add" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-4 gap-2">
          <NumInput label="kcal" value={kcal} onChange={setKcal} integer autoFocus />
          <NumInput label="Protein g" value={p} onChange={setP} />
          <NumInput label="Carbs g" value={c} onChange={setC} />
          <NumInput label="Fat g" value={f} onChange={setF} />
        </div>
        <Select label="Meal" value={slot} onChange={setSlot} options={SLOT_OPTIONS} />
        <Button type="submit" variant="primary" className="w-full" disabled={k == null}>
          Add
        </Button>
      </form>
    </Sheet>
  );
}

// ---------- Edit an entry ----------

export function EntrySheet({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  return (
    <Sheet open={!!entry} onClose={onClose} title="Edit entry">
      {entry && <EntryEditor key={entry.id} entry={entry} onClose={onClose} />}
    </Sheet>
  );
}

function EntryEditor({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const [grams, setGrams] = useState(String(entry.grams ?? ''));
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [p, setP] = useState(String(entry.protein_g));
  const [c, setC] = useState(String(entry.carbs_g));
  const [f, setF] = useState(String(entry.fat_g));
  const [slot, setSlot] = useState<MealSlot>(entry.meal_slot);
  const g = parseNum(grams);
  const byWeight = entry.grams != null;
  const preview = byWeight && g ? rescaleEntry(entry, g) : null;
  return (
    <div className="space-y-3">
      <div className="font-semibold">{entry.food_name}</div>
      {byWeight ? (
        <>
          <NumInput label="Amount" suffix="g" value={grams} onChange={setGrams} />
          {preview && (
            <div className="rounded-xl bg-card2 p-3 text-center">
              <MacroLine {...preview} />
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <NumInput label="kcal" value={kcal} onChange={setKcal} />
          <NumInput label="P g" value={p} onChange={setP} />
          <NumInput label="C g" value={c} onChange={setC} />
          <NumInput label="F g" value={f} onChange={setF} />
        </div>
      )}
      <Select label="Meal" value={slot} onChange={setSlot} options={SLOT_OPTIONS} />
      <div className="flex gap-2">
        <Button
          variant="danger"
          className="flex-1"
          onClick={async () => {
            await db.food_entries.delete(entry.id);
            onClose();
          }}
        >
          Delete
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={byWeight ? !g || g <= 0 : parseNum(kcal) == null}
          onClick={async () => {
            if (byWeight) await db.food_entries.update(entry.id, { grams: g!, ...rescaleEntry(entry, g!), meal_slot: slot });
            else
              await db.food_entries.update(entry.id, {
                kcal: Math.round(parseNum(kcal) ?? 0),
                protein_g: parseNum(p) ?? 0,
                carbs_g: parseNum(c) ?? 0,
                fat_g: parseNum(f) ?? 0,
                meal_slot: slot,
              });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
