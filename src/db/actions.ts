import { db, nowIso, uid, setSetting } from './db';
import { macrosForGrams } from '../lib/calc';
import { addDays } from '../lib/dates';
import type { FoodDraft } from '../lib/off';
import type { CardioEntry, Food, FoodEntry, MealSlot, MealTemplate, Workout, WorkoutTemplate } from '../lib/types';

export async function logFood(food: Food, grams: number, date: string, slot: MealSlot) {
  const entry: FoodEntry = {
    id: uid(),
    date,
    food_id: food.id,
    food_name: food.brand ? `${food.name} (${food.brand})` : food.name,
    barcode: food.barcode,
    grams,
    ...macrosForGrams(food, grams),
    meal_slot: slot,
    logged_at: nowIso(),
  };
  await db.transaction('rw', db.food_entries, db.foods, async () => {
    await db.food_entries.add(entry);
    await db.foods.update(food.id, { last_grams: grams });
  });
  return entry;
}

export async function logMealTemplate(template: MealTemplate, date: string) {
  const foods = await db.foods.bulkGet(template.items.map((i) => i.food_id));
  const at = nowIso();
  const entries: FoodEntry[] = [];
  template.items.forEach((item, i) => {
    const food = foods[i];
    if (!food) return;
    entries.push({
      id: uid(),
      date,
      food_id: food.id,
      food_name: food.brand ? `${food.name} (${food.brand})` : food.name,
      barcode: food.barcode,
      grams: item.grams,
      ...macrosForGrams(food, item.grams),
      meal_slot: template.meal_slot,
      logged_at: at,
    });
  });
  await db.food_entries.bulkAdd(entries);
  return entries;
}

export async function quickAdd(date: string, slot: MealSlot, name: string, m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
  await db.food_entries.add({
    id: uid(),
    date,
    food_id: null,
    food_name: name.trim() || 'Quick add',
    barcode: null,
    grams: null,
    ...m,
    meal_slot: slot,
    logged_at: nowIso(),
  });
}

export async function copyDay(fromDate: string, toDate: string) {
  const src = await db.food_entries.where('date').equals(fromDate).toArray();
  const at = nowIso();
  const copies = src.map((e) => ({ ...e, id: uid(), date: toDate, logged_at: at }));
  await db.food_entries.bulkAdd(copies);
  return copies.map((e) => e.id);
}

export const copyYesterday = (date: string) => copyDay(addDays(date, -1), date);

/** Save a food from a draft (custom or Open Food Facts). Updates the existing record for the barcode if any. */
export async function saveFoodDraft(
  draft: FoodDraft & { kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number },
  source: Food['source'],
): Promise<Food> {
  const existing = draft.barcode ? await db.foods.where('barcode').equals(draft.barcode).first() : undefined;
  const food: Food = {
    id: existing?.id ?? uid(),
    name: draft.name.trim() || 'Unnamed food',
    brand: draft.brand?.trim() || null,
    barcode: draft.barcode?.trim() || null,
    kcal_per_100g: draft.kcal_per_100g,
    protein_g_per_100g: draft.protein_g_per_100g,
    carbs_g_per_100g: draft.carbs_g_per_100g,
    fat_g_per_100g: draft.fat_g_per_100g,
    source,
    last_grams: existing?.last_grams ?? null,
    updated_at: nowIso(),
  };
  await db.foods.put(food);
  return food;
}

export async function setWeight(date: string, weight_kg: number) {
  await db.weights.put({ date, weight_kg, logged_at: nowIso() });
}

export async function setSteps(date: string, steps: number) {
  await db.steps.put({ date, steps });
}

export async function setNotes(date: string, notes: string) {
  if (notes.trim()) await db.day_notes.put({ date, notes });
  else await db.day_notes.delete(date);
}

export async function startWorkout(date: string, template: WorkoutTemplate | null): Promise<string> {
  const w: Workout = {
    id: uid(),
    date,
    name: template?.name ?? 'Workout',
    template_id: template?.id ?? null,
    started_at: nowIso(),
    finished_at: null,
    exercises: (template?.exercises ?? []).map((name) => ({ name, sets: [] })),
  };
  await db.workouts.add(w);
  return w.id;
}

export async function addCardio(entry: Omit<CardioEntry, 'id' | 'logged_at'>) {
  await db.cardio.add({ ...entry, id: uid(), logged_at: nowIso() });
}

export async function markExported() {
  await setSetting('last_full_export_at', nowIso());
}
