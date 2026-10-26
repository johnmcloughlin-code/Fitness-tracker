// Open Food Facts product parsing (pure) and lookup.

export interface FoodDraft {
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
}

export type OffResult =
  | { status: 'found'; draft: FoodDraft & { kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number } }
  | { status: 'incomplete'; draft: FoodDraft }
  | { status: 'not_found'; draft: FoodDraft }
  | { status: 'offline'; draft: FoodDraft }
  | { status: 'error'; draft: FoodDraft; message: string };

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export function emptyDraft(barcode: string): FoodDraft {
  return {
    name: '',
    brand: null,
    barcode,
    kcal_per_100g: null,
    protein_g_per_100g: null,
    carbs_g_per_100g: null,
    fat_g_per_100g: null,
  };
}

export function parseOffProduct(json: unknown, barcode: string): OffResult {
  const j = json as { status?: number; product?: Record<string, unknown> } | null;
  if (!j || j.status !== 1 || !j.product) return { status: 'not_found', draft: emptyDraft(barcode) };
  const p = j.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const name = String(p.product_name_en || p.product_name || p.generic_name || '').trim();
  const brand = String(p.brands ?? '').split(',')[0].trim() || null;
  const draft: FoodDraft = {
    name,
    brand,
    barcode,
    kcal_per_100g: kcal == null ? null : Math.round(kcal),
    protein_g_per_100g: r1(num(n.proteins_100g)),
    carbs_g_per_100g: r1(num(n.carbohydrates_100g)),
    fat_g_per_100g: r1(num(n.fat_100g)),
  };
  const complete =
    draft.name &&
    draft.kcal_per_100g != null &&
    draft.protein_g_per_100g != null &&
    draft.carbs_g_per_100g != null &&
    draft.fat_g_per_100g != null;
  return complete ? { status: 'found', draft: draft as Extract<OffResult, { status: 'found' }>['draft'] } : { status: 'incomplete', draft };
}

export async function lookupBarcode(barcode: string, fetchImpl: typeof fetch = fetch): Promise<OffResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline', draft: emptyDraft(barcode) };
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,generic_name,brands,nutriments`;
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    return { status: 'offline', draft: emptyDraft(barcode) };
  }
  if (res.status === 404) return { status: 'not_found', draft: emptyDraft(barcode) };
  if (!res.ok) return { status: 'error', draft: emptyDraft(barcode), message: `Open Food Facts returned ${res.status}` };
  try {
    return parseOffProduct(await res.json(), barcode);
  } catch {
    return { status: 'error', draft: emptyDraft(barcode), message: 'Could not read the Open Food Facts response' };
  }
}
