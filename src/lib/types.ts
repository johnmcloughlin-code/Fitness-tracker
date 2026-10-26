// Record shapes. Stored in IndexedDB exactly as exported to JSON (snake_case, units in names).

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'evening';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'evening'];

export interface Profile {
  sex: 'male' | 'female';
  age_years: number;
  height_cm: number;
  start_weight_kg: number;
  start_date: string; // YYYY-MM-DD
}

export interface Goal {
  type: 'cut';
  end_date: string;
  weekly_loss_min_kg: number;
  weekly_loss_max_kg: number;
}

export interface Targets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  steps: number;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  source: 'seed' | 'open_food_facts' | 'custom';
  last_grams: number | null;
  updated_at: string;
}

export interface FoodEntry extends Macros {
  id: string;
  date: string;
  food_id: string | null; // null for quick-add
  food_name: string;
  barcode: string | null;
  grams: number | null; // null for quick-add
  meal_slot: MealSlot;
  logged_at: string;
}

export interface MealTemplateItem {
  food_id: string;
  grams: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  meal_slot: MealSlot;
  items: MealTemplateItem[];
  sort_order: number;
}

export interface WeightEntry {
  date: string;
  weight_kg: number;
  logged_at: string;
}

export interface StepsEntry {
  date: string;
  steps: number;
}

export interface DayNote {
  date: string;
  notes: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  weekdays: number[]; // ISO 1 = Mon .. 7 = Sun
  exercises: string[];
}

export interface WorkoutSet {
  weight_kg: number;
  reps: number;
  rpe: number | null;
}

export interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string;
  name: string;
  template_id: string | null;
  started_at: string;
  finished_at: string | null;
  exercises: WorkoutExercise[];
}

export type CardioType = 'bike' | 'incline_walk';

export interface CardioEntry {
  id: string;
  date: string;
  type: CardioType;
  minutes: number;
  avg_hr_bpm: number | null;
  kcal: number | null;
  logged_at: string;
}

export interface BodyScan {
  id: string;
  date: string;
  device: string | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  fat_mass_kg: number | null;
  lean_mass_kg: number | null;
  skeletal_muscle_kg: number | null;
  visceral_fat_level: number | null;
  abdominal_circumference_cm: number | null;
  waist_cm: number | null;
  bmr_kcal: number | null;
}

export const BODY_SCAN_FIELDS: { key: keyof BodyScan; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Body fat', unit: '%' },
  { key: 'fat_mass_kg', label: 'Fat mass', unit: 'kg' },
  { key: 'lean_mass_kg', label: 'Lean mass', unit: 'kg' },
  { key: 'skeletal_muscle_kg', label: 'Skeletal muscle', unit: 'kg' },
  { key: 'visceral_fat_level', label: 'Visceral fat level', unit: '' },
  { key: 'abdominal_circumference_cm', label: 'Abdominal circumference', unit: 'cm' },
  { key: 'waist_cm', label: 'Waist', unit: 'cm' },
  { key: 'bmr_kcal', label: 'BMR', unit: 'kcal' },
];

/** Everything the app stores, in export shape. */
export interface AppData {
  profile: Profile;
  goal: Goal;
  targets: Targets;
  weights: WeightEntry[];
  food_entries: FoodEntry[];
  foods: Food[];
  meal_templates: MealTemplate[];
  workouts: Workout[];
  workout_templates: WorkoutTemplate[];
  cardio: CardioEntry[];
  steps: StepsEntry[];
  day_notes: DayNote[];
  body_scans: BodyScan[];
}
