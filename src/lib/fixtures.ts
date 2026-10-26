// Deterministic 3-week dataset (Mon 26/10/2026 to Sun 15/11/2026) for tests.
import { addDays, dateRange, isoWeekday } from './dates';
import { seedData } from './seed';
import type { AppData, FoodEntry, Workout } from './types';

export const FIXTURE_START = '2026-10-26';
export const FIXTURE_END = '2026-11-15';

export function fixtureData(): AppData {
  const data = seedData();
  const days = dateRange(FIXTURE_START, FIXTURE_END);
  const noise = [0, 0.3, -0.2, 0.1, -0.1, 0.2, -0.3];

  data.weights = days
    .filter((_, i) => i !== 9) // missed weigh-in on day 10
    .map((date) => {
      const i = days.indexOf(date);
      // Week 2 drops fast (> 1.25 %), week 3 stalls (< 0.5 %).
      const trend = i < 14 ? 88.3 - i * 0.17 : 86.3;
      return { date, weight_kg: Math.round((trend + noise[i % 7]) * 10) / 10, logged_at: `${date}T07:05:00.000Z` };
    });

  const entries: FoodEntry[] = [];
  days.forEach((date, i) => {
    if (i === 12) return; // no food logged
    const lowProtein = i === 3 || i === 17;
    const meals: [string, FoodEntry['meal_slot'], number, number, number, number][] = [
      ['Post-gym', 'breakfast', 480, 52, 45, 8],
      ['Lunch', 'lunch', 530, 55, 56, 5],
      ['Afternoon', 'snack', 210, 24, 22, 2],
      [i % 2 ? 'Dinner A' : 'Dinner B', 'dinner', 560 + (i % 3) * 40, lowProtein ? 10 : 45, 52, 18],
      ['Evening', 'evening', 270, 34, 11, 10],
    ];
    meals.forEach(([name, slot, kcal, p, c, f], j) =>
      entries.push({
        id: `fe-${i}-${j}`,
        date,
        food_id: null,
        food_name: name,
        barcode: null,
        grams: null,
        kcal,
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        meal_slot: slot,
        logged_at: `${date}T12:00:00.000Z`,
      }),
    );
  });
  data.food_entries = entries;

  data.steps = days.filter((_, i) => i % 5 !== 4).map((date, i) => ({ date, steps: 10500 + ((i * 731) % 3000) }));
  data.day_notes = [
    { date: '2026-10-28', notes: 'Slept badly | 5 h' },
    { date: '2026-11-07', notes: 'Wedding\nlate dinner' },
  ];

  const workouts: Workout[] = [];
  days.forEach((date, i) => {
    const wd = isoWeekday(date);
    if (wd === 7 || i === 11) return; // Sunday rest; skipped Fri of week 2
    const tpl = data.workout_templates.find((t) => t.weekdays.includes(wd))!;
    const week = Math.floor(i / 7);
    workouts.push({
      id: `w-${i}`,
      date,
      name: tpl.name,
      template_id: tpl.id,
      started_at: `${date}T06:30:00.000Z`,
      finished_at: `${date}T07:30:00.000Z`,
      exercises: tpl.exercises.map((name, k) => {
        let base = 40 + k * 10 + week * 2.5;
        if (name === 'Leg press' && week === 2) base = 60; // big drop in week 3
        return {
          name,
          sets: [
            { weight_kg: base, reps: 8, rpe: 8 },
            { weight_kg: base, reps: 7, rpe: 9 },
            { weight_kg: base - 5, reps: 10, rpe: null },
          ],
        };
      }),
    });
  });
  data.workouts = workouts;

  data.cardio = days
    .filter((_, i) => i % 2 === 0)
    .map((date, i) => ({
      id: `c-${i}`,
      date,
      type: i % 2 ? 'bike' : 'incline_walk',
      minutes: 20 + (i % 3) * 5,
      avg_hr_bpm: 125,
      kcal: null,
      logged_at: `${date}T08:00:00.000Z`,
    }));

  data.body_scans.push({
    id: 'scan-2',
    date: addDays(FIXTURE_START, 14),
    device: 'Evolt 360',
    weight_kg: 86.5,
    body_fat_pct: 22.6,
    fat_mass_kg: 19.5,
    lean_mass_kg: 67.0,
    skeletal_muscle_kg: 37.1,
    visceral_fat_level: 7,
    abdominal_circumference_cm: 92.0,
    waist_cm: 88.5,
    bmr_kcal: 1810,
  });
  return data;
}
