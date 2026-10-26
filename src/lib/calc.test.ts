import { describe, expect, it } from 'vitest';
import {
  adherence,
  averageInWindow,
  bestSet,
  epley1RM,
  lastSessionSets,
  macrosForGrams,
  movingAverage,
  projectTrend,
  rescaleEntry,
  strengthStatus,
  sumMacros,
  type DaySummary,
} from './calc';
import type { FoodEntry, WeightEntry, Workout } from './types';

const w = (date: string, weight_kg: number): WeightEntry => ({ date, weight_kg, logged_at: `${date}T07:00:00Z` });

describe('macrosForGrams', () => {
  const yogurt = { kcal_per_100g: 57, protein_g_per_100g: 10.3, carbs_g_per_100g: 4, fat_g_per_100g: 0.2 };
  it('scales per-100 g values', () => {
    expect(macrosForGrams(yogurt, 250)).toEqual({ kcal: 143, protein_g: 25.8, carbs_g: 10, fat_g: 0.5 });
  });
  it('returns zero for zero grams', () => {
    expect(macrosForGrams(yogurt, 0)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
  it('sums and rescales', () => {
    const a = macrosForGrams(yogurt, 100);
    expect(sumMacros([a, a])).toEqual({ kcal: 114, protein_g: 20.6, carbs_g: 8, fat_g: 0.4 });
    const entry = { ...a, grams: 100 } as FoodEntry;
    expect(rescaleEntry(entry, 50)).toEqual({ kcal: 29, protein_g: 5.2, carbs_g: 2, fat_g: 0.1 });
  });
});

describe('moving average', () => {
  const weights = [w('2026-10-26', 88), w('2026-10-27', 87), w('2026-10-29', 86), w('2026-11-02', 85), w('2026-11-03', 84)];
  it('averages the trailing 7 calendar days', () => {
    expect(averageInWindow(weights, '2026-10-29')).toBeCloseTo(87);
    // 03/11 window = 28/10..03/11 → 86, 85, 84
    expect(averageInWindow(weights, '2026-11-03')).toBeCloseTo(85);
    expect(averageInWindow(weights, '2026-10-20')).toBeNull();
  });
  it('evaluates on each weigh-in date, sorted', () => {
    const ma = movingAverage([...weights].reverse());
    expect(ma.map((p) => p.date)).toEqual(weights.map((x) => x.date));
    expect(ma[0].value).toBe(88);
    expect(ma[4].value).toBeCloseTo(85);
  });
});

describe('weekly rate and projection', () => {
  it('fits a straight line over the last 14 days and projects', () => {
    const weights = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10);
      return w(d, 90 - 0.1 * i);
    });
    const t = projectTrend(weights, '2026-11-14', '2026-12-18')!;
    expect(t.slope_kg_per_day).toBeCloseTo(-0.1);
    expect(t.slope_kg_per_week).toBeCloseTo(-0.7);
    expect(t.fitted_kg).toBeCloseTo(88.1);
    expect(t.projected_kg).toBeCloseTo(88.1 - 3.4);
    expect(t.line[0].date).toBe('2026-11-01');
    expect(t.line[1].date).toBe('2026-12-18');
  });
  it('needs two distinct dates', () => {
    expect(projectTrend([w('2026-10-26', 88)], '2026-10-26', '2026-12-18')).toBeNull();
  });
});

describe('Epley 1RM', () => {
  it('computes estimated 1RM', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(0, 5)).toBe(0);
  });
  it('picks the best set by e1RM', () => {
    expect(bestSet([{ weight_kg: 100, reps: 5, rpe: null }, { weight_kg: 90, reps: 10, rpe: null }])!.set.weight_kg).toBe(90);
    expect(bestSet([])).toBeNull();
  });
});

describe('strength history', () => {
  const mk = (id: string, date: string, weight: number, reps = 5): Workout => ({
    id,
    date,
    name: 'Push',
    template_id: null,
    started_at: `${date}T06:00:00Z`,
    finished_at: null,
    exercises: [{ name: 'Bench press', sets: [{ weight_kg: weight, reps, rpe: null }] }],
  });
  const workouts = [mk('a', '2026-10-26', 100), mk('b', '2026-10-29', 102.5), mk('c', '2026-11-02', 95)];
  it('returns the previous session sets for an exercise', () => {
    expect(lastSessionSets(workouts, 'bench press', 'c')!.workout_id).toBe('b');
    expect(lastSessionSets(workouts, 'Squat')).toBeNull();
  });
  it('flags a drop of more than 5 % vs the best in the cut', () => {
    const s = strengthStatus(workouts, 'Bench press', '2026-10-26')!;
    expect(s.best_date).toBe('2026-10-29');
    expect(s.change_pct).toBeCloseTo(-7.32, 1);
    expect(s.dropped).toBe(true);
    expect(strengthStatus(workouts, 'Bench press', '2026-10-26', '2026-10-29')!.dropped).toBe(false);
  });
});

describe('adherence', () => {
  const targets = { kcal: 2000, protein_g: 200, carbs_g: 170, fat_g: 60, steps: 12000 };
  const day = (over: Partial<DaySummary>): DaySummary => ({
    date: '2026-10-26',
    kcal: 2050,
    protein_g: 205,
    carbs_g: 170,
    fat_g: 60,
    weight_kg: null,
    food_logged: true,
    steps: 12500,
    workout_names: ['Push'],
    workout_planned: true,
    cardio_minutes: 0,
    notes: '',
    ...over,
  });
  it('scores all four checks', () => {
    expect(adherence(day({}), targets)).toMatchObject({ hits: 4, checks: 4, score_pct: 100 });
  });
  it('kcal must be within ±100', () => {
    expect(adherence(day({ kcal: 2100 }), targets).kcal_ok).toBe(true);
    expect(adherence(day({ kcal: 2101 }), targets).kcal_ok).toBe(false);
    expect(adherence(day({ kcal: 1899 }), targets).kcal_ok).toBe(false);
  });
  it('ignores the workout check on rest days', () => {
    const a = adherence(day({ workout_planned: false, workout_names: [], steps: 100 }), targets);
    expect(a.workout_ok).toBeNull();
    expect(a).toMatchObject({ hits: 2, checks: 3 });
  });
  it('fails food checks when nothing is logged', () => {
    const a = adherence(day({ food_logged: false, kcal: 0, protein_g: 0, workout_names: [] }), targets);
    expect(a).toMatchObject({ kcal_ok: false, protein_ok: false, workout_ok: false, hits: 1, score_pct: 25 });
  });
});
