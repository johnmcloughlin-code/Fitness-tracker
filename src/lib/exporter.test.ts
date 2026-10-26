import { describe, expect, it } from 'vitest';
import { buildCsvBundle, buildFullExport, exportFilename, toCsv, validateImport } from './exporter';
import { fixtureData } from './fixtures';
import { parseOffProduct } from './off';

describe('full JSON export', () => {
  const data = fixtureData();
  const out = buildFullExport(data, '2026-11-15T10:00:00.000Z');

  it('has the top-level shape', () => {
    expect(out.schema_version).toBe(1);
    expect(out.exported_at).toBe('2026-11-15T10:00:00.000Z');
    for (const k of ['profile', 'targets', 'weights', 'food_entries', 'foods', 'workouts', 'cardio', 'steps', 'body_scans'])
      expect(out).toHaveProperty(k);
    expect(out.food_entries[0]).toHaveProperty('protein_g');
    expect(out.weights[0]).toHaveProperty('weight_kg');
    expect(exportFilename('json', '2026-11-15')).toBe('cut-tracker-export-2026-11-15.json');
  });

  it('round-trips losslessly through validation', () => {
    const parsed = JSON.parse(JSON.stringify(out));
    const res = validateImport(parsed);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual(data);
      expect(res.counts.workouts).toBe(data.workouts.length);
    }
  });

  it('rejects bad files with readable errors', () => {
    expect(validateImport(null).ok).toBe(false);
    expect(validateImport({ schema_version: 99 })).toEqual({ ok: false, errors: [expect.stringContaining('schema_version')] });
    const bad = JSON.parse(JSON.stringify(out));
    bad.weights[0].weight_kg = 'heavy';
    delete bad.cardio;
    const res = validateImport(bad);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain('weights[0].weight_kg: expected number, got "heavy"');
      expect(res.errors).toContain('cardio: missing array');
    }
  });
});

describe('CSV bundle', () => {
  it('writes one CSV per table with quoting', () => {
    const files = buildCsvBundle(fixtureData());
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['weights.csv', 'food_entries.csv', 'foods.csv', 'workouts.csv', 'workout_sets.csv', 'cardio.csv', 'steps.csv', 'body_scans.csv']),
    );
    expect(files['weights.csv'].split('\r\n')[0]).toBe('date,weight_kg,logged_at');
    expect(files['day_notes.csv']).toContain('"Wedding\nlate dinner"');
    expect(toCsv(['a', 'b'], [{ a: 'x,"y"', b: null }])).toBe('a,b\r\n"x,""y""",\r\n');
  });
});

describe('Open Food Facts parsing', () => {
  it('reads a complete product', () => {
    const r = parseOffProduct(
      {
        status: 1,
        product: {
          product_name: 'Skyr',
          brands: 'Arla, Arla Foods',
          nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 },
        },
      },
      '123',
    );
    expect(r).toEqual({
      status: 'found',
      draft: { name: 'Skyr', brand: 'Arla', barcode: '123', kcal_per_100g: 63, protein_g_per_100g: 11, carbs_g_per_100g: 4, fat_g_per_100g: 0.2 },
    });
  });
  it('converts kJ and reports incomplete products', () => {
    const r = parseOffProduct({ status: 1, product: { product_name: 'Bar', nutriments: { energy_100g: 1674, proteins_100g: 20 } } }, '9');
    expect(r.status).toBe('incomplete');
    expect(r.draft.kcal_per_100g).toBe(400);
    expect(r.draft.carbs_g_per_100g).toBeNull();
  });
  it('reports not found', () => {
    expect(parseOffProduct({ status: 0 }, '9').status).toBe('not_found');
  });
});
