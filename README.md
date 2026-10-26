# Cut Tracker

A mobile-first, local-first PWA for one person to track bodyweight, workouts and food during a cut, and to export everything in a form an AI coach (Claude) can analyse.

- **Stack:** Vite + React + TypeScript, Tailwind CSS v4, Dexie (IndexedDB), vite-plugin-pwa, `@zxing/browser` for barcodes, `fflate` for the CSV zip.
- **No backend, no accounts.** All data stays in IndexedDB on the phone. The only network call is the Open Food Facts lookup for barcodes not already cached.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # Vitest unit tests (calculations + Markdown snapshot)
npm run test:e2e     # Playwright smoke test (builds, then runs against `vite preview`)
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ on http://localhost:4173
```

The camera only works on `https://` or `localhost`. To try scanning on your phone during development, deploy a preview to Vercel (below) or use `npm run dev -- --host` behind an HTTPS tunnel.

`npm run icons` regenerates the PNG icons from `public/favicon.svg` (needs Playwright's Chromium).

## Deploy to Vercel

The repo includes `vercel.json` (Vite preset, `dist/` output, no-cache on `sw.js`).

**Option A: CLI**

```bash
npm i -g vercel
vercel login
vercel link            # first time only; accept the detected Vite settings
vercel --prod
```

**Option B: Git.** In the Vercel dashboard choose *Add New → Project*, import this GitHub repo and deploy with the defaults. Every push to the default branch redeploys.

## Install on iPhone

1. Open the deployed URL in **Safari** (it must be Safari for Add to Home Screen).
2. Tap **Share → Add to Home Screen → Add**.
3. Launch it from the home screen icon. It runs full screen and works offline.
4. The first barcode scan asks for camera permission. If you deny it by mistake: Settings → Apps → Safari → Camera → Allow (or remove and re-add the app).

The app calls `navigator.storage.persist()` on first load so iOS is less likely to evict its data, but **iOS can still delete website data**, for example if the app goes unused for weeks or you clear Safari data. Use the Full JSON export as your backup; the Today screen nags you when the last one is over 7 days old.

## Export and import

Open **More → Export & import**.

| Button | What you get |
|---|---|
| **Copy for Claude** | A compact Markdown report for the chosen range (7 days, 14 days, whole cut, or custom). It goes to the clipboard and can also be downloaded as `.md`. Sections: header (range, goal, days remaining, targets, weight trend), weekly summary per ISO week, daily table, strength (best set and Epley e1RM, start vs end of range), latest body scan vs baseline, and computed flags. No individual food items. About 85 lines for 3 weeks. |
| **Full JSON** | `cut-tracker-export-YYYY-MM-DD.json`. Lossless: `schema_version`, `exported_at`, `timezone`, `profile`, `goal`, `targets`, and arrays `weights`, `food_entries`, `foods`, `meal_templates`, `workouts` (sessions → exercises → sets), `workout_templates`, `cardio`, `steps`, `day_notes`, `body_scans`. snake_case with units in field names (`weight_kg`, `protein_g`, `kcal_per_100g`). Dates are `YYYY-MM-DD` in Europe/London, timestamps are ISO 8601 UTC. |
| **CSV bundle** | `cut-tracker-export-YYYY-MM-DD.zip` with one CSV per table and the same column names as the JSON. Nested data is flattened: `workouts.csv` + `workout_sets.csv`, and `meal_template_items.csv`. |

On iPhone, the file buttons open the share sheet so you can **Save to Files** or AirDrop the file.

**Import** accepts a Full JSON file. It is validated (schema version, required fields and types), then shows a preview of record counts. You then choose:

- **Merge:** upserts every record by its key (`id`, or `date` for weights/steps/notes). Nothing on the phone is deleted. Profile, goal and targets are taken from the file.
- **Replace all:** wipes the phone's data and restores the file exactly (asks for confirmation).

## How things are calculated

All calculations are pure functions in `src/lib/` with unit tests.

- **Macros:** `per_100g × grams / 100`; kcal rounded to whole numbers, macros to 0.1 g.
- **7-day moving average:** mean of the weigh-ins in the trailing 7 calendar days (gaps are skipped, not interpolated).
- **Weekly change (Weight screen):** 7-day average today vs the 7-day average 7 days ago, in kg and %.
- **Projection:** least-squares line through the weigh-ins of the last 14 days, extended to the goal end date.
- **Estimated 1RM:** Epley, `weight × (1 + reps / 30)`; a single rep counts as the weight itself. Best set = highest e1RM.
- **Strength drop flag:** latest session's best e1RM is more than 5% below the best e1RM since the cut start date.
- **Adherence (per day):** kcal within ±100 of target; protein ≥ target; scheduled workout done (only checked on days a template is scheduled); steps ≥ target. Score = checks hit ÷ checks applicable.

## Assumptions and choices

- **Dates.** Every day is a Europe/London calendar date, shown as DD/MM/YYYY. Date pickers use the iOS native wheel but always display DD/MM/YYYY.
- **Olive oil** is stored per 100 ml, and its "grams" in templates and entries mean millilitres (5 ml in Dinner A). There is no separate unit system.
- **"1 apple"** in the Afternoon template is 180 g.
- **Seed food values** are generic UK/Irish label values per 100 g (carbs exclude fibre). All are editable in Settings → Foods. The Post-gym template is in the Breakfast slot; other templates map to the obvious slot.
- **Meal-template quick-add** logs each item as its own food entry, so entries stay editable individually. A toast offers Undo.
- **Copy yesterday** copies all of the previous day's entries onto the day you are viewing.
- **Default meal slot** follows the London time: before 11:00 breakfast, before 15:00 lunch, before 17:30 snack, before 20:30 dinner, then evening.
- **Default grams** for a food is the last amount you logged of it, otherwise 100 g.
- **Workout schedule** comes from the current templates' weekdays (Push Mon/Thu, Pull Tue/Fri, Legs Wed/Sat, Sunday rest). Editing a template changes "planned" counts for past days too.
- **Workout "done"** means any workout session exists for that day (even unfinished).
- **Report averages** (kcal, macros, steps) use only days that have data. Days with no food are listed in Flags instead.
- **Weekly change in the report** compares each ISO week's average weight with the previous ISO week's, using all stored weigh-ins (so the first week of a range still has a comparison if data exists before it). Loss flags use that % change: below 0.5% or above 1.25% of bodyweight; a gain counts as loss below 0.5%.
- **Protein flag** uses a fixed 180 g, as specified, independent of the protein target.
- **Strength table** compares the first and the last session in the range that include each exercise. Exercises are matched by name, case-insensitively.
- **Baseline scan** is the earliest body scan; "latest" is the most recent scan on or before the end of the range.
- **Full JSON and CSV** always contain all data; the date range only applies to Copy for Claude.
- **"Last full export"** is updated by Full JSON only (CSV is not a restorable backup). The reminder banner counts from first install until the first export.
- **Offline barcode lookups** are not queued. If a barcode isn't cached and you're offline, the app says so plainly and offers to create the food from the label. Foods already looked up or created work offline.
- **Wipe all data** (type WIPE to confirm) deletes everything and restores the starting seed data.
- **Scan formats:** EAN-13, EAN-8, UPC-A, UPC-E and Code 128. Haptics use `navigator.vibrate` where supported; iOS Safari doesn't support it, so the confirmation there is the green flash plus the scanned code.

## Project layout

```
src/lib/         pure logic: dates, calc, report (Markdown), exporter (JSON/CSV/import validation), off (Open Food Facts), seed, fixtures
src/db/          Dexie schema, load/write helpers, user actions
src/screens/     Today, Food, Weight, Train, Workout, History, Body scans, Export, Settings, More
src/components/  UI primitives, food sheets, barcode scanner, weight chart
e2e/             Playwright smoke test
docs/PLAN.md     original build plan
```
