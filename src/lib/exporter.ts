// Lossless JSON export, CSV bundle, and import validation.
import { TIMEZONE } from './dates';
import type { AppData } from './types';

export const SCHEMA_VERSION = 1;

export interface FullExport extends AppData {
  schema_version: number;
  app: 'cut-tracker';
  exported_at: string;
  timezone: string;
}

export function buildFullExport(data: AppData, exportedAt: string): FullExport {
  return {
    schema_version: SCHEMA_VERSION,
    app: 'cut-tracker',
    exported_at: exportedAt,
    timezone: TIMEZONE,
    profile: data.profile,
    goal: data.goal,
    targets: data.targets,
    weights: data.weights,
    food_entries: data.food_entries,
    foods: data.foods,
    meal_templates: data.meal_templates,
    workouts: data.workouts,
    workout_templates: data.workout_templates,
    cardio: data.cardio,
    steps: data.steps,
    day_notes: data.day_notes,
    body_scans: data.body_scans,
  };
}

export function exportFilename(ext: string, date: string): string {
  return `cut-tracker-export-${date}.${ext}`;
}

// ---------- CSV ----------

function csvValue(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvValue(r[c])).join(','))].join('\r\n') + '\r\n';
}

/** One CSV per table. Nested workouts are flattened into workouts.csv + workout_sets.csv. */
export function buildCsvBundle(data: AppData): Record<string, string> {
  const files: Record<string, string> = {};
  const add = (name: string, columns: string[], rows: Record<string, unknown>[]) => {
    files[`${name}.csv`] = toCsv(columns, rows);
  };
  add('profile', ['sex', 'age_years', 'height_cm', 'start_weight_kg', 'start_date'], [{ ...data.profile }]);
  add('goal', ['type', 'end_date', 'weekly_loss_min_kg', 'weekly_loss_max_kg'], [{ ...data.goal }]);
  add('targets', ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'steps'], [{ ...data.targets }]);
  add('weights', ['date', 'weight_kg', 'logged_at'], data.weights.map((r) => ({ ...r })));
  add(
    'food_entries',
    ['id', 'date', 'meal_slot', 'food_id', 'food_name', 'barcode', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'logged_at'],
    data.food_entries.map((r) => ({ ...r })),
  );
  add(
    'foods',
    ['id', 'name', 'brand', 'barcode', 'kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g', 'fat_g_per_100g', 'source', 'last_grams', 'updated_at'],
    data.foods.map((r) => ({ ...r })),
  );
  add(
    'meal_template_items',
    ['template_id', 'template_name', 'meal_slot', 'sort_order', 'food_id', 'grams'],
    data.meal_templates.flatMap((t) =>
      t.items.map((i) => ({ template_id: t.id, template_name: t.name, meal_slot: t.meal_slot, sort_order: t.sort_order, ...i })),
    ),
  );
  add(
    'workouts',
    ['id', 'date', 'name', 'template_id', 'started_at', 'finished_at'],
    data.workouts.map((r) => ({ ...r })),
  );
  add(
    'workout_sets',
    ['workout_id', 'date', 'workout_name', 'exercise_index', 'exercise_name', 'set_number', 'weight_kg', 'reps', 'rpe'],
    data.workouts.flatMap((w) =>
      w.exercises.flatMap((e, ei) =>
        e.sets.map((s, si) => ({
          workout_id: w.id,
          date: w.date,
          workout_name: w.name,
          exercise_index: ei,
          exercise_name: e.name,
          set_number: si + 1,
          ...s,
        })),
      ),
    ),
  );
  add(
    'workout_templates',
    ['id', 'name', 'weekdays', 'exercises'],
    data.workout_templates.map((t) => ({ ...t, weekdays: t.weekdays.join(';'), exercises: t.exercises.join(';') })),
  );
  add('cardio', ['id', 'date', 'type', 'minutes', 'avg_hr_bpm', 'kcal', 'logged_at'], data.cardio.map((r) => ({ ...r })));
  add('steps', ['date', 'steps'], data.steps.map((r) => ({ ...r })));
  add('day_notes', ['date', 'notes'], data.day_notes.map((r) => ({ ...r })));
  add(
    'body_scans',
    [
      'id',
      'date',
      'device',
      'weight_kg',
      'body_fat_pct',
      'fat_mass_kg',
      'lean_mass_kg',
      'skeletal_muscle_kg',
      'visceral_fat_level',
      'abdominal_circumference_cm',
      'waist_cm',
      'bmr_kcal',
    ],
    data.body_scans.map((r) => ({ ...r })),
  );
  return files;
}

// ---------- Import validation ----------

type FieldType = 'string' | 'number' | 'string?' | 'number?' | 'array' | 'boolean';
type Spec = Record<string, FieldType>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SPECS: Record<string, Spec> = {
  weights: { date: 'string', weight_kg: 'number', logged_at: 'string' },
  food_entries: {
    id: 'string',
    date: 'string',
    food_id: 'string?',
    food_name: 'string',
    barcode: 'string?',
    grams: 'number?',
    kcal: 'number',
    protein_g: 'number',
    carbs_g: 'number',
    fat_g: 'number',
    meal_slot: 'string',
    logged_at: 'string',
  },
  foods: {
    id: 'string',
    name: 'string',
    brand: 'string?',
    barcode: 'string?',
    kcal_per_100g: 'number',
    protein_g_per_100g: 'number',
    carbs_g_per_100g: 'number',
    fat_g_per_100g: 'number',
    source: 'string',
    last_grams: 'number?',
    updated_at: 'string',
  },
  meal_templates: { id: 'string', name: 'string', meal_slot: 'string', items: 'array', sort_order: 'number' },
  workouts: { id: 'string', date: 'string', name: 'string', template_id: 'string?', started_at: 'string', finished_at: 'string?', exercises: 'array' },
  workout_templates: { id: 'string', name: 'string', weekdays: 'array', exercises: 'array' },
  cardio: { id: 'string', date: 'string', type: 'string', minutes: 'number', avg_hr_bpm: 'number?', kcal: 'number?', logged_at: 'string' },
  steps: { date: 'string', steps: 'number' },
  day_notes: { date: 'string', notes: 'string' },
  body_scans: {
    id: 'string',
    date: 'string',
    device: 'string?',
    weight_kg: 'number?',
    body_fat_pct: 'number?',
    fat_mass_kg: 'number?',
    lean_mass_kg: 'number?',
    skeletal_muscle_kg: 'number?',
    visceral_fat_level: 'number?',
    abdominal_circumference_cm: 'number?',
    waist_cm: 'number?',
    bmr_kcal: 'number?',
  },
};

const OBJECT_SPECS: Record<string, Spec> = {
  profile: { sex: 'string', age_years: 'number', height_cm: 'number', start_weight_kg: 'number', start_date: 'string' },
  goal: { type: 'string', end_date: 'string', weekly_loss_min_kg: 'number', weekly_loss_max_kg: 'number' },
  targets: { kcal: 'number', protein_g: 'number', carbs_g: 'number', fat_g: 'number', steps: 'number' },
};

export const TABLES = Object.keys(SPECS) as (keyof typeof SPECS)[];

function checkType(v: unknown, t: FieldType): boolean {
  switch (t) {
    case 'string':
      return typeof v === 'string';
    case 'string?':
      return v == null || typeof v === 'string';
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'number?':
      return v == null || (typeof v === 'number' && Number.isFinite(v));
    case 'array':
      return Array.isArray(v);
    case 'boolean':
      return typeof v === 'boolean';
  }
}

function checkRecord(rec: unknown, spec: Spec, where: string, errors: string[]) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    errors.push(`${where}: not an object`);
    return;
  }
  const r = rec as Record<string, unknown>;
  for (const [k, t] of Object.entries(spec)) {
    if (!checkType(r[k], t)) errors.push(`${where}.${k}: expected ${t}, got ${JSON.stringify(r[k])}`);
  }
  for (const k of ['date', 'start_date', 'end_date'])
    if (k in spec && typeof r[k] === 'string' && !DATE_RE.test(r[k] as string)) errors.push(`${where}.${k}: expected YYYY-MM-DD`);
}

export type ImportResult =
  | { ok: true; data: AppData; exported_at: string; counts: Record<string, number> }
  | { ok: false; errors: string[] };

export function validateImport(input: unknown): ImportResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['File is not a JSON object.'] };
  const o = input as Record<string, unknown>;
  if (o.schema_version !== SCHEMA_VERSION)
    return { ok: false, errors: [`Unsupported schema_version ${JSON.stringify(o.schema_version)} (expected ${SCHEMA_VERSION}).`] };
  for (const [k, spec] of Object.entries(OBJECT_SPECS)) checkRecord(o[k], spec, k, errors);
  for (const [table, spec] of Object.entries(SPECS)) {
    const arr = o[table];
    if (!Array.isArray(arr)) {
      errors.push(`${table}: missing array`);
      continue;
    }
    arr.forEach((rec, i) => checkRecord(rec, spec, `${table}[${i}]`, errors));
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 20).concat(errors.length > 20 ? [`…and ${errors.length - 20} more`] : []) };
  const data = Object.fromEntries(['profile', 'goal', 'targets', ...TABLES].map((k) => [k, o[k]])) as unknown as AppData;
  return {
    ok: true,
    data,
    exported_at: typeof o.exported_at === 'string' ? o.exported_at : '',
    counts: Object.fromEntries(TABLES.map((t) => [t, (o[t] as unknown[]).length])),
  };
}
