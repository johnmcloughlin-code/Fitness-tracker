import { addDays, dateRange, daysBetween, isoWeekday } from './dates';
import type {
  AppData,
  Food,
  FoodEntry,
  Macros,
  Targets,
  WeightEntry,
  Workout,
  WorkoutSet,
  WorkoutTemplate,
} from './types';

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Macros ----------

/** Macros for a given weight of a food defined per 100 g. kcal to whole numbers, grams to 0.1 g. */
export function macrosForGrams(
  food: Pick<Food, 'kcal_per_100g' | 'protein_g_per_100g' | 'carbs_g_per_100g' | 'fat_g_per_100g'>,
  grams: number,
): Macros {
  const f = grams / 100;
  return {
    kcal: Math.round(food.kcal_per_100g * f),
    protein_g: round1(food.protein_g_per_100g * f),
    carbs_g: round1(food.carbs_g_per_100g * f),
    fat_g: round1(food.fat_g_per_100g * f),
  };
}

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein_g: acc.protein_g + e.protein_g,
      carbs_g: acc.carbs_g + e.carbs_g,
      fat_g: acc.fat_g + e.fat_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
  return { kcal: Math.round(t.kcal), protein_g: round1(t.protein_g), carbs_g: round1(t.carbs_g), fat_g: round1(t.fat_g) };
}

/** Rescale an existing entry to a new amount (keeps its per-gram ratio). */
export function rescaleEntry(entry: FoodEntry, grams: number): Macros {
  if (!entry.grams) return { kcal: entry.kcal, protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g };
  const r = grams / entry.grams;
  return {
    kcal: Math.round(entry.kcal * r),
    protein_g: round1(entry.protein_g * r),
    carbs_g: round1(entry.carbs_g * r),
    fat_g: round1(entry.fat_g * r),
  };
}

// ---------- Weight ----------

export interface DatedValue {
  date: string;
  value: number;
}

/** Trailing calendar-window average ending on `date` (inclusive). Null if no weigh-ins in the window. */
export function averageInWindow(weights: WeightEntry[], date: string, window = 7): number | null {
  const from = addDays(date, -(window - 1));
  const vals = weights.filter((w) => w.date >= from && w.date <= date).map((w) => w.weight_kg);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** 7-day moving average evaluated on each weigh-in date. */
export function movingAverage(weights: WeightEntry[], window = 7): DatedValue[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w) => ({ date: w.date, value: averageInWindow(sorted, w.date, window)! }));
}

export interface WeeklyChange {
  current_avg_kg: number;
  previous_avg_kg: number;
  change_kg: number;
  change_pct: number;
}

/** Change in the 7-day average: window ending `asOf` vs window ending 7 days earlier. */
export function weeklyChange(weights: WeightEntry[], asOf: string): WeeklyChange | null {
  const current = averageInWindow(weights, asOf);
  const previous = averageInWindow(weights, addDays(asOf, -7));
  if (current == null || previous == null) return null;
  const change = current - previous;
  return {
    current_avg_kg: current,
    previous_avg_kg: previous,
    change_kg: change,
    change_pct: (change / previous) * 100,
  };
}

export interface Trend {
  slope_kg_per_day: number;
  slope_kg_per_week: number;
  /** Fitted weight on `asOf`. */
  fitted_kg: number;
  /** Fitted weight on the target date. */
  projected_kg: number;
  /** Two-point line from the first weigh-in in the window to the target date. */
  line: DatedValue[];
}

/** Least-squares fit of weigh-ins from the last `days` days up to asOf, extended to targetDate. */
export function projectTrend(
  weights: WeightEntry[],
  asOf: string,
  targetDate: string,
  days = 14,
): Trend | null {
  const from = addDays(asOf, -(days - 1));
  const pts = weights
    .filter((w) => w.date >= from && w.date <= asOf)
    .map((w) => ({ x: daysBetween(asOf, w.date), y: w.weight_kg }));
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
  const intercept = my - slope * mx; // value at x = 0 (asOf)
  const at = (key: string) => intercept + slope * daysBetween(asOf, key);
  const firstDate = weights.filter((w) => w.date >= from && w.date <= asOf).map((w) => w.date).sort()[0];
  return {
    slope_kg_per_day: slope,
    slope_kg_per_week: slope * 7,
    fitted_kg: intercept,
    projected_kg: at(targetDate),
    line: [
      { date: firstDate, value: at(firstDate) },
      { date: targetDate, value: at(targetDate) },
    ],
  };
}

// ---------- Strength ----------

/** Epley estimated 1RM. One rep returns the weight itself. */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function bestSet(sets: WorkoutSet[]): { set: WorkoutSet; e1rm: number } | null {
  let best: { set: WorkoutSet; e1rm: number } | null = null;
  for (const s of sets) {
    const e = epley1RM(s.weight_kg, s.reps);
    if (e <= 0) continue;
    if (!best || e > best.e1rm || (e === best.e1rm && s.weight_kg > best.set.weight_kg)) best = { set: s, e1rm: e };
  }
  return best;
}

const norm = (s: string) => s.trim().toLowerCase();

export interface ExerciseSession {
  workout_id: string;
  date: string;
  sets: WorkoutSet[];
  best: { set: WorkoutSet; e1rm: number };
}

/** Sessions (oldest first) containing at least one valid set of the exercise. */
export function exerciseHistory(workouts: Workout[], exercise: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.started_at.localeCompare(b.started_at));
  for (const w of sorted) {
    const sets = w.exercises.filter((e) => norm(e.name) === norm(exercise)).flatMap((e) => e.sets);
    const best = bestSet(sets);
    if (best) out.push({ workout_id: w.id, date: w.date, sets, best });
  }
  return out;
}

/** Sets from the most recent other session that included this exercise. */
export function lastSessionSets(workouts: Workout[], exercise: string, excludeWorkoutId?: string): ExerciseSession | null {
  const hist = exerciseHistory(
    workouts.filter((w) => w.id !== excludeWorkoutId),
    exercise,
  );
  return hist.length ? hist[hist.length - 1] : null;
}

export interface StrengthStatus {
  best_e1rm: number;
  best_date: string;
  latest_e1rm: number;
  latest_date: string;
  change_pct: number; // latest vs best, <= 0
  dropped: boolean; // more than 5 % below best
}

export const STRENGTH_DROP_PCT = 5;

/** Latest session's e1RM vs the best since `since` (the cut start), up to `until`. */
export function strengthStatus(
  workouts: Workout[],
  exercise: string,
  since: string,
  until = '9999-12-31',
): StrengthStatus | null {
  const hist = exerciseHistory(workouts, exercise).filter((h) => h.date >= since && h.date <= until);
  if (!hist.length) return null;
  let best = hist[0];
  for (const h of hist) if (h.best.e1rm > best.best.e1rm) best = h;
  const latest = hist[hist.length - 1];
  const change = ((latest.best.e1rm - best.best.e1rm) / best.best.e1rm) * 100;
  return {
    best_e1rm: best.best.e1rm,
    best_date: best.date,
    latest_e1rm: latest.best.e1rm,
    latest_date: latest.date,
    change_pct: change,
    dropped: change < -STRENGTH_DROP_PCT,
  };
}

// ---------- Days & adherence ----------

export function scheduledTemplate(templates: WorkoutTemplate[], date: string): WorkoutTemplate | null {
  const wd = isoWeekday(date);
  return templates.find((t) => t.weekdays.includes(wd)) ?? null;
}

export interface DaySummary extends Macros {
  date: string;
  weight_kg: number | null;
  food_logged: boolean;
  steps: number | null;
  workout_names: string[];
  workout_planned: boolean;
  cardio_minutes: number;
  notes: string;
}

export function summariseDays(data: AppData, dates: string[]): DaySummary[] {
  const byDate = <T extends { date: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const arr = m.get(r.date);
      if (arr) arr.push(r);
      else m.set(r.date, [r]);
    }
    return m;
  };
  const food = byDate(data.food_entries);
  const workouts = byDate(data.workouts);
  const cardio = byDate(data.cardio);
  const weights = new Map(data.weights.map((w) => [w.date, w.weight_kg]));
  const steps = new Map(data.steps.map((s) => [s.date, s.steps]));
  const notes = new Map(data.day_notes.map((n) => [n.date, n.notes]));
  return dates.map((date) => {
    const entries = food.get(date) ?? [];
    return {
      date,
      ...sumMacros(entries),
      weight_kg: weights.get(date) ?? null,
      food_logged: entries.length > 0,
      steps: steps.get(date) ?? null,
      workout_names: (workouts.get(date) ?? []).map((w) => w.name),
      workout_planned: scheduledTemplate(data.workout_templates, date) != null,
      cardio_minutes: (cardio.get(date) ?? []).reduce((a, c) => a + c.minutes, 0),
      notes: notes.get(date) ?? '',
    };
  });
}

export const KCAL_TOLERANCE = 100;

export interface Adherence {
  kcal_ok: boolean;
  protein_ok: boolean;
  /** null when no workout was scheduled that day (rest day) */
  workout_ok: boolean | null;
  steps_ok: boolean;
  hits: number;
  checks: number;
  score_pct: number;
}

export function adherence(day: DaySummary, targets: Targets): Adherence {
  const kcal_ok = day.food_logged && Math.abs(day.kcal - targets.kcal) <= KCAL_TOLERANCE;
  const protein_ok = day.food_logged && day.protein_g >= targets.protein_g;
  const workout_ok = day.workout_planned ? day.workout_names.length > 0 : null;
  const steps_ok = day.steps != null && day.steps >= targets.steps;
  const results = [kcal_ok, protein_ok, steps_ok, ...(workout_ok == null ? [] : [workout_ok])];
  const hits = results.filter(Boolean).length;
  return {
    kcal_ok,
    protein_ok,
    workout_ok,
    steps_ok,
    hits,
    checks: results.length,
    score_pct: (hits / results.length) * 100,
  };
}

/** Days in [start, end] clamped so the range never starts after it ends. */
export function clampRange(start: string, end: string): string[] {
  return start <= end ? dateRange(start, end) : [];
}
