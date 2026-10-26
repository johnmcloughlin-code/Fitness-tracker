import type { AppData, BodyScan, Food, MealTemplate, WorkoutTemplate } from './types';

const T0 = '2026-10-26T00:00:00.000Z';

type SeedFood = [id: string, name: string, kcal: number, protein: number, carbs: number, fat: number];

// Generic per-100 g values (UK/IE labelling: carbs exclude fibre). All editable in Settings → Foods.
const SEED_FOODS: SeedFood[] = [
  ['seed-greek-yogurt-0', 'Greek yogurt 0% fat', 57, 10.3, 4.0, 0.2],
  ['seed-whey', 'Whey protein powder', 390, 78, 6, 6],
  ['seed-oats', 'Rolled oats', 375, 11, 60, 8],
  ['seed-berries', 'Mixed berries', 45, 1, 9, 0.3],
  ['seed-chicken-breast-raw', 'Chicken breast, raw', 106, 24, 0, 1.1],
  ['seed-rice-cooked', 'White rice, cooked', 130, 2.7, 28, 0.3],
  ['seed-mixed-veg', 'Mixed vegetables', 45, 2.5, 6.5, 0.5],
  ['seed-apple', 'Apple', 52, 0.3, 11.8, 0.2],
  ['seed-beef-mince-5', 'Beef mince 5% fat, raw', 125, 21, 0, 5],
  ['seed-potatoes', 'Potatoes', 77, 2, 17, 0.1],
  ['seed-olive-oil', 'Olive oil (per 100 ml)', 824, 0, 0, 91.6],
  ['seed-salmon', 'Salmon fillet, raw', 200, 20, 0, 13],
  ['seed-cottage-cheese-lf', 'Cottage cheese, low fat', 72, 12, 3.5, 1.5],
  ['seed-peanut-butter', 'Peanut butter', 600, 25, 12, 50],
];

export const seedFoods: Food[] = SEED_FOODS.map(([id, name, kcal, p, c, f]) => ({
  id,
  name,
  brand: null,
  barcode: null,
  kcal_per_100g: kcal,
  protein_g_per_100g: p,
  carbs_g_per_100g: c,
  fat_g_per_100g: f,
  source: 'seed',
  last_grams: null,
  updated_at: T0,
}));

export const seedMealTemplates: MealTemplate[] = [
  {
    id: 'meal-post-gym',
    name: 'Post-gym',
    meal_slot: 'breakfast',
    sort_order: 1,
    items: [
      { food_id: 'seed-greek-yogurt-0', grams: 250 },
      { food_id: 'seed-whey', grams: 30 },
      { food_id: 'seed-oats', grams: 30 },
      { food_id: 'seed-berries', grams: 100 },
    ],
  },
  {
    id: 'meal-lunch',
    name: 'Lunch',
    meal_slot: 'lunch',
    sort_order: 2,
    items: [
      { food_id: 'seed-chicken-breast-raw', grams: 200 },
      { food_id: 'seed-rice-cooked', grams: 150 },
      { food_id: 'seed-mixed-veg', grams: 200 },
    ],
  },
  {
    id: 'meal-afternoon',
    name: 'Afternoon',
    meal_slot: 'snack',
    sort_order: 3,
    items: [
      { food_id: 'seed-whey', grams: 30 },
      { food_id: 'seed-apple', grams: 180 },
    ],
  },
  {
    id: 'meal-dinner-a',
    name: 'Dinner A',
    meal_slot: 'dinner',
    sort_order: 4,
    items: [
      { food_id: 'seed-beef-mince-5', grams: 200 },
      { food_id: 'seed-potatoes', grams: 250 },
      { food_id: 'seed-mixed-veg', grams: 200 },
      { food_id: 'seed-olive-oil', grams: 5 },
    ],
  },
  {
    id: 'meal-dinner-b',
    name: 'Dinner B',
    meal_slot: 'dinner',
    sort_order: 5,
    items: [
      { food_id: 'seed-salmon', grams: 150 },
      { food_id: 'seed-potatoes', grams: 250 },
      { food_id: 'seed-mixed-veg', grams: 200 },
    ],
  },
  {
    id: 'meal-evening',
    name: 'Evening',
    meal_slot: 'evening',
    sort_order: 6,
    items: [
      { food_id: 'seed-cottage-cheese-lf', grams: 250 },
      { food_id: 'seed-peanut-butter', grams: 15 },
    ],
  },
];

export const seedWorkoutTemplates: WorkoutTemplate[] = [
  {
    id: 'wt-push',
    name: 'Push',
    weekdays: [1, 4],
    exercises: ['Bench press', 'Shoulder press', 'Incline DB press', 'Machine flyes', 'Rope tricep pushdown'],
  },
  {
    id: 'wt-pull',
    name: 'Pull',
    weekdays: [2, 5],
    exercises: ['Lat pulldown', 'Seated row', 'Chest-supported row', 'Rear delt fly', 'Curls'],
  },
  {
    id: 'wt-legs',
    name: 'Legs',
    weekdays: [3, 6],
    exercises: ['Hip thrust', 'Leg extension', 'Lying leg curl', 'Leg press', 'Adductor'],
  },
];

export const seedBaselineScan: BodyScan = {
  id: 'scan-baseline',
  date: '2026-10-26',
  device: 'Evolt 360',
  weight_kg: 88.3,
  body_fat_pct: 23.8,
  fat_mass_kg: 21.0,
  lean_mass_kg: 67.3,
  skeletal_muscle_kg: 37.3,
  visceral_fat_level: 8,
  abdominal_circumference_cm: 94.3,
  waist_cm: null,
  bmr_kcal: 1823,
};

export function seedData(): AppData {
  return {
    profile: { sex: 'male', age_years: 24, height_cm: 181, start_weight_kg: 88.3, start_date: '2026-10-26' },
    goal: { type: 'cut', end_date: '2026-12-18', weekly_loss_min_kg: 0.8, weekly_loss_max_kg: 1.0 },
    targets: { kcal: 2000, protein_g: 200, carbs_g: 170, fat_g: 60, steps: 12000 },
    weights: [{ date: '2026-10-26', weight_kg: 88.3, logged_at: T0 }],
    food_entries: [],
    foods: seedFoods,
    meal_templates: seedMealTemplates,
    workouts: [],
    workout_templates: seedWorkoutTemplates,
    cardio: [],
    steps: [],
    day_notes: [],
    body_scans: [seedBaselineScan],
  };
}
