# Cut Tracker: build plan

## Data model (Dexie / IndexedDB, snake_case, same shape as the JSON export)
| table | key | fields |
|---|---|---|
| `settings` | `key` | `profile`, `targets`, `goal`, `last_full_export_at`, `installed_at` |
| `foods` | `id`, idx `barcode`, `name` | name, brand, barcode, kcal/protein_g/carbs_g/fat_g per 100 g, source (seed/off/custom), last_grams, updated_at |
| `food_entries` | `id`, idx `date` | date, food_id, food_name, barcode, grams, kcal, protein_g, carbs_g, fat_g, meal_slot, logged_at |
| `meal_templates` | `id` | name, meal_slot, items[{food_id, grams}] |
| `weights` | `date` | weight_kg, logged_at |
| `steps` | `date` | steps |
| `day_notes` | `date` | notes |
| `workout_templates` | `id` | name, weekdays[1..7], exercises[] |
| `workouts` | `id`, idx `date` | date, name, template_id, started_at, finished_at, exercises[{name, sets[{weight_kg, reps, rpe}]}] |
| `cardio` | `id`, idx `date` | date, type, minutes, avg_hr_bpm, kcal |
| `body_scans` | `id`, idx `date` | all Evolt fields + waist_cm |

Dates are `YYYY-MM-DD` keys computed in Europe/London, displayed DD/MM/YYYY.

## Screens (bottom tab bar: Today · Food · Weight · Train · More)
- **Today**: remaining kcal/protein, macro bars, weight + steps entry, today's workout + Start, meal-template quick-add, notes, export-reminder banner.
- **Food**: day navigator, entries by meal slot (edit/delete), Scan, Search, Quick add, Copy yesterday.
- **Weight**: entry, 7-day MA, weekly change, SVG chart with projection to the goal end date.
- **Train**: start from template, session logger with last-session sets inline, e1RM and drop flags, cardio form.
- **More**: History, Body scans, Export, Settings (targets, profile, templates, foods, import, wipe).

## File structure
```
src/lib/      pure logic: dates, calc (macros, MA, rate, projection, epley, adherence), report (markdown), export (json/csv), import validation, off (Open Food Facts parse)
src/db/       Dexie schema, seed, repository helpers
src/screens/  one file per screen
src/components/ shared UI (Sheet, NumberInput, BarcodeScanner, WeightChart, ...)
e2e/          Playwright smoke test
```
