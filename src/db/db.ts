import Dexie, { type Table } from 'dexie';
import type {
  AppData,
  BodyScan,
  CardioEntry,
  DayNote,
  Food,
  FoodEntry,
  Goal,
  MealTemplate,
  Profile,
  StepsEntry,
  Targets,
  WeightEntry,
  Workout,
  WorkoutTemplate,
} from '../lib/types';
import { seedData } from '../lib/seed';

export interface SettingsRow {
  key: string;
  value: unknown;
}

export class CutDB extends Dexie {
  settings!: Table<SettingsRow, string>;
  foods!: Table<Food, string>;
  food_entries!: Table<FoodEntry, string>;
  meal_templates!: Table<MealTemplate, string>;
  weights!: Table<WeightEntry, string>;
  steps!: Table<StepsEntry, string>;
  day_notes!: Table<DayNote, string>;
  workout_templates!: Table<WorkoutTemplate, string>;
  workouts!: Table<Workout, string>;
  cardio!: Table<CardioEntry, string>;
  body_scans!: Table<BodyScan, string>;

  constructor(name = 'cut-tracker') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      foods: 'id, barcode, name, updated_at',
      food_entries: 'id, date, food_id',
      meal_templates: 'id, sort_order',
      weights: 'date',
      steps: 'date',
      day_notes: 'date',
      workout_templates: 'id',
      workouts: 'id, date',
      cardio: 'id, date',
      body_scans: 'id, date',
    });
  }
}

export const db = new CutDB();

export const DATA_TABLES = [
  'foods',
  'food_entries',
  'meal_templates',
  'weights',
  'steps',
  'day_notes',
  'workout_templates',
  'workouts',
  'cardio',
  'body_scans',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export function uid(): string {
  return crypto.randomUUID();
}

export const nowIso = () => new Date().toISOString();

// ----- settings -----

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}

export async function loadAll(): Promise<AppData> {
  const [profile, goal, targets] = await Promise.all([
    getSetting<Profile>('profile'),
    getSetting<Goal>('goal'),
    getSetting<Targets>('targets'),
  ]);
  const seed = seedData();
  const tables = await Promise.all(DATA_TABLES.map((t) => db.table(t).toArray()));
  const data = Object.fromEntries(DATA_TABLES.map((t, i) => [t, tables[i]])) as Pick<AppData, DataTable>;
  return {
    profile: profile ?? seed.profile,
    goal: goal ?? seed.goal,
    targets: targets ?? seed.targets,
    ...data,
  };
}

/** Write a whole AppData. mode 'replace' clears everything first; 'merge' upserts by primary key. */
export async function writeAll(data: AppData, mode: 'merge' | 'replace') {
  await db.transaction('rw', [db.settings, ...DATA_TABLES.map((t) => db.table(t))], async () => {
    if (mode === 'replace') await Promise.all(DATA_TABLES.map((t) => db.table(t).clear()));
    await setSetting('profile', data.profile);
    await setSetting('goal', data.goal);
    await setSetting('targets', data.targets);
    for (const t of DATA_TABLES) await db.table(t).bulkPut(data[t] as unknown[]);
  });
}

/** Seed on first run. Returns true if seeding happened. */
export async function ensureSeeded(): Promise<boolean> {
  const seeded = await getSetting<boolean>('seeded');
  if (seeded) return false;
  await writeAll(seedData(), 'replace');
  await setSetting('installed_at', nowIso());
  await setSetting('seeded', true);
  return true;
}

export async function wipeAll() {
  await db.transaction('rw', [db.settings, ...DATA_TABLES.map((t) => db.table(t))], async () => {
    await db.settings.clear();
    await Promise.all(DATA_TABLES.map((t) => db.table(t).clear()));
  });
}
