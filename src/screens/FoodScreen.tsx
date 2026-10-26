import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { copyYesterday } from '../db/actions';
import { sumMacros } from '../lib/calc';
import { addDays, formatDateLong } from '../lib/dates';
import { MEAL_SLOTS, type FoodEntry } from '../lib/types';
import { useSettings, useToday } from '../hooks';
import { Bar, Button, Card, useToast } from '../components/ui';
import { EntrySheet, QuickAddSheet, ScanSheet, SearchSheet, SLOT_LABEL } from '../components/food';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function FoodScreen({ dateParam }: { dateParam: string | null }) {
  const today = useToday();
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : today;
  const settings = useSettings();
  const toast = useToast();
  const entries = useLiveQuery(() => db.food_entries.where('date').equals(date).sortBy('logged_at'), [date]);
  const [sheet, setSheet] = useState<'scan' | 'search' | 'quick' | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const totals = sumMacros(entries ?? []);
  const t = settings?.targets;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <a href={`#/food?date=${addDays(date, -1)}`} className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-muted" aria-label="Previous day">
          ‹
        </a>
        <div className="text-center">
          <h1 className="text-xl font-bold">Food</h1>
          <div className="text-sm text-muted">{date === today ? `Today · ${formatDateLong(date)}` : formatDateLong(date)}</div>
        </div>
        <a
          href={date < today ? `#/food?date=${addDays(date, 1)}` : undefined}
          className={`flex min-h-11 min-w-11 items-center justify-center text-2xl ${date < today ? 'text-muted' : 'text-transparent'}`}
          aria-label="Next day"
        >
          ›
        </a>
      </header>

      {t && (
        <Card className="space-y-2">
          <Bar label="Calories" value={totals.kcal} target={t.kcal} unit="kcal" />
          <Bar overIsGood label="Protein" value={totals.protein_g} target={t.protein_g} unit="g" />
          <Bar label="Carbs" value={totals.carbs_g} target={t.carbs_g} unit="g" />
          <Bar label="Fat" value={totals.fat_g} target={t.fat_g} unit="g" />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => setSheet('scan')}>
          Scan barcode
        </Button>
        <Button onClick={() => setSheet('search')}>Search foods</Button>
        <Button onClick={() => setSheet('quick')}>Quick add</Button>
        <Button
          onClick={async () => {
            const ids = await copyYesterday(date);
            if (!ids.length) return toast('Nothing logged the day before.');
            toast(`Copied ${ids.length} items from yesterday`, { label: 'Undo', run: () => db.food_entries.bulkDelete(ids) });
          }}
        >
          Copy yesterday
        </Button>
      </div>

      {MEAL_SLOTS.map((slot) => {
        const items = (entries ?? []).filter((e) => e.meal_slot === slot);
        if (!items.length) return null;
        const sub = sumMacros(items);
        return (
          <Card key={slot} className="py-3">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="font-semibold">{SLOT_LABEL[slot]}</h2>
              <span className="tabular text-sm text-muted">
                {sub.kcal} kcal · P {sub.protein_g.toFixed(0)}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {items.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setEditing(e)} className="flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left">
                    <span className="min-w-0">
                      <span className="block truncate">{e.food_name}</span>
                      <span className="tabular text-xs text-muted">
                        {e.grams != null ? `${e.grams} g · ` : ''}P {e.protein_g.toFixed(0)} · C {e.carbs_g.toFixed(0)} · F {e.fat_g.toFixed(0)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm">{e.kcal}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      {entries && !entries.length && <p className="py-6 text-center text-muted">Nothing logged for this day yet.</p>}

      <ScanSheet open={sheet === 'scan'} onClose={() => setSheet(null)} date={date} />
      <SearchSheet open={sheet === 'search'} onClose={() => setSheet(null)} date={date} />
      <QuickAddSheet open={sheet === 'quick'} onClose={() => setSheet(null)} date={date} />
      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
