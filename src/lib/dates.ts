// All dates in the app are "date keys": YYYY-MM-DD strings for a calendar day in Europe/London.
// Arithmetic on keys is done in UTC so it is free of DST effects.

export const TIMEZONE = 'Europe/London';

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Date key for an instant, as seen in Europe/London. */
export function toDateKey(d: Date): string {
  return keyFormatter.format(d);
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

function keyToUtc(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtc(b).getTime() - keyToUtc(a).getTime()) / 86_400_000);
}

/** Inclusive list of date keys from start to end. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(key: string): number {
  const dow = keyToUtc(key).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Monday of the ISO week containing key. */
export function startOfIsoWeek(key: string): string {
  return addDays(key, 1 - isoWeekday(key));
}

/** ISO week label, e.g. "2026-W44". */
export function isoWeekLabel(key: string): string {
  const d = keyToUtc(key);
  // Thursday of this week decides the ISO year.
  d.setUTCDate(d.getUTCDate() + 4 - isoWeekday(key));
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** DD/MM/YYYY */
export function formatDate(key: string): string {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/** DD/MM */
export function formatDayMonth(key: string): string {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function weekdayShort(key: string): string {
  return WEEKDAY_SHORT[isoWeekday(key) - 1];
}
export const WEEKDAY_NAMES = WEEKDAY_SHORT;

/** "Mon 26/10/2026" */
export function formatDateLong(key: string): string {
  return `${weekdayShort(key)} ${formatDate(key)}`;
}

/** Parse DD/MM/YYYY into a date key, or null. */
export function parseUkDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const key = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return utcToKey(keyToUtc(key)) === key ? key : null;
}

/** HH:MM in Europe/London for an ISO timestamp. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
