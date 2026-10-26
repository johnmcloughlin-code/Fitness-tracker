// "Copy for Claude" Markdown report. Pure: same data in, same text out.
import {
  adherence,
  averageInWindow,
  exerciseHistory,
  projectTrend,
  strengthStatus,
  summariseDays,
  clampRange,
  type DaySummary,
} from './calc';
import { daysBetween, formatDate, formatDayMonth, isoWeekLabel, startOfIsoWeek, weekdayShort, addDays } from './dates';
import { BODY_SCAN_FIELDS, type AppData, type BodyScan } from './types';

export const PROTEIN_FLAG_G = 180;
export const WEEKLY_LOSS_LOW_PCT = 0.5;
export const WEEKLY_LOSS_HIGH_PCT = 1.25;

export interface ReportRange {
  start: string;
  end: string;
}

const DASH = '—';

function fmt(n: number | null | undefined, dp = 0): string {
  if (n == null || Number.isNaN(n)) return DASH;
  return n.toFixed(dp);
}

function signed(n: number | null | undefined, dp = 1): string {
  if (n == null || Number.isNaN(n)) return DASH;
  const s = n.toFixed(dp);
  if (Number(s) === 0) return (0).toFixed(dp);
  return n > 0 ? `+${s}` : s;
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function cell(s: string): string {
  return s.replace(/\|/g, '/').replace(/\s*\n\s*/g, '; ').trim();
}

function table(header: string[], rows: string[][]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
}

interface WeekRow {
  label: string;
  start: string;
  days: DaySummary[];
  avgWeight: number | null;
  prevAvgWeight: number | null;
  changeKg: number | null;
  changePct: number | null;
}

function weekRows(data: AppData, days: DaySummary[]): WeekRow[] {
  const groups = new Map<string, DaySummary[]>();
  for (const d of days) {
    const ws = startOfIsoWeek(d.date);
    const g = groups.get(ws);
    if (g) g.push(d);
    else groups.set(ws, [d]);
  }
  // Average weight of a whole ISO week, using all data (not just the range) so week 1 has a comparison.
  const weekAvg = (ws: string) =>
    avg(data.weights.filter((w) => w.date >= ws && w.date <= addDays(ws, 6)).map((w) => w.weight_kg));
  return [...groups.entries()].map(([ws, ds]) => {
    const a = weekAvg(ws);
    const p = weekAvg(addDays(ws, -7));
    const change = a != null && p != null ? a - p : null;
    return {
      label: isoWeekLabel(ws),
      start: ws,
      days: ds,
      avgWeight: a,
      prevAvgWeight: p,
      changeKg: change,
      changePct: change != null && p ? (change / p) * 100 : null,
    };
  });
}

function scanDate(s: BodyScan) {
  return formatDate(s.date) + (s.device ? ` (${s.device})` : '');
}

export function buildClaudeReport(data: AppData, range: ReportRange, today: string): string {
  const { profile, goal, targets } = data;
  const days = summariseDays(data, clampRange(range.start, range.end));
  const L: string[] = [];

  // ----- Header -----
  const daysLeft = daysBetween(today, goal.end_date);
  const latestAvg = averageInWindow(data.weights, range.end);
  const trend = projectTrend(data.weights, range.end, goal.end_date);
  L.push(`# Cut Tracker report: ${formatDate(range.start)} to ${formatDate(range.end)}`);
  L.push('');
  L.push(
    `- Goal: ${goal.type}, end date ${formatDate(goal.end_date)}, ${Math.max(daysLeft, 0)} days remaining (as of ${formatDate(today)})`,
  );
  L.push(
    `- Profile: ${profile.sex}, ${profile.age_years} y, ${profile.height_cm} cm, start ${fmt(profile.start_weight_kg, 1)} kg on ${formatDate(profile.start_date)}`,
  );
  L.push(
    `- Targets: ${targets.kcal} kcal, protein ${targets.protein_g} g, carbs ${targets.carbs_g} g, fat ${targets.fat_g} g, ${targets.steps} steps, loss ${fmt(goal.weekly_loss_min_kg, 1)}–${fmt(goal.weekly_loss_max_kg, 1)} kg/week`,
  );
  L.push(
    `- Weight: 7-day avg ${fmt(latestAvg, 1)} kg at ${formatDate(range.end)} (${signed(latestAvg != null ? latestAvg - profile.start_weight_kg : null)} kg vs start)` +
      (trend
        ? `; 14-day trend ${signed(trend.slope_kg_per_week, 2)} kg/week; projected ${fmt(trend.projected_kg, 1)} kg on ${formatDate(goal.end_date)}`
        : '; not enough weigh-ins for a 14-day trend'),
  );
  L.push(
    '- Notes on method: averages use only days with data; adherence = kcal within ±100 of target, protein ≥ target, scheduled workout done, steps ≥ target; est. 1RM = Epley.',
  );

  // ----- Weekly summary -----
  L.push('', '## Weekly summary', '');
  const weeks = weekRows(data, days);
  L.push(
    ...table(
      ['Week', 'Dates', 'Avg wt kg', 'Δ kg', 'Δ %', 'kcal', 'P g', 'C g', 'F g', 'Steps', 'Workouts', 'Cardio min', 'Adherence %'],
      weeks.map((w) => {
        const fed = w.days.filter((d) => d.food_logged);
        const stepDays = w.days.filter((d) => d.steps != null);
        const adh = w.days.map((d) => adherence(d, targets));
        const hits = adh.reduce((a, x) => a + x.hits, 0);
        const checks = adh.reduce((a, x) => a + x.checks, 0);
        const done = w.days.reduce((a, d) => a + d.workout_names.length, 0);
        const planned = w.days.filter((d) => d.workout_planned).length;
        const last = w.days[w.days.length - 1].date;
        return [
          w.label,
          `${formatDayMonth(w.days[0].date)}–${formatDayMonth(last)}`,
          fmt(w.avgWeight, 1),
          signed(w.changeKg, 2),
          signed(w.changePct, 2),
          fmt(avg(fed.map((d) => d.kcal))),
          fmt(avg(fed.map((d) => d.protein_g))),
          fmt(avg(fed.map((d) => d.carbs_g))),
          fmt(avg(fed.map((d) => d.fat_g))),
          fmt(avg(stepDays.map((d) => d.steps!))),
          `${done}/${planned}`,
          String(w.days.reduce((a, d) => a + d.cardio_minutes, 0)),
          checks ? fmt((hits / checks) * 100) : DASH,
        ];
      }),
    ),
  );

  // ----- Daily table -----
  L.push('', '## Daily', '');
  L.push(
    ...table(
      ['Date', 'Wt kg', 'kcal', 'P', 'C', 'F', 'Steps', 'Workout', 'Cardio min', 'Notes'],
      days.map((d) => [
        `${weekdayShort(d.date)} ${formatDayMonth(d.date)}`,
        fmt(d.weight_kg, 1),
        d.food_logged ? String(d.kcal) : DASH,
        d.food_logged ? fmt(d.protein_g) : DASH,
        d.food_logged ? fmt(d.carbs_g) : DASH,
        d.food_logged ? fmt(d.fat_g) : DASH,
        d.steps != null ? String(d.steps) : DASH,
        d.workout_names.length ? cell(d.workout_names.join(' + ')) : 'rest',
        d.cardio_minutes ? String(d.cardio_minutes) : DASH,
        cell(d.notes),
      ]),
    ),
  );

  // ----- Strength -----
  L.push('', '## Strength (best set and est. 1RM, start vs end of range)', '');
  const inRange = data.workouts.filter((w) => w.date >= range.start && w.date <= range.end);
  const exerciseNames: string[] = [];
  const seen = new Set<string>();
  for (const w of [...inRange].sort((a, b) => a.date.localeCompare(b.date)))
    for (const e of w.exercises) {
      const k = e.name.trim().toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        exerciseNames.push(e.name.trim());
      }
    }
  const strengthRows: string[][] = [];
  for (const name of exerciseNames) {
    const hist = exerciseHistory(inRange, name);
    if (!hist.length) continue;
    const first = hist[0];
    const last = hist[hist.length - 1];
    const set = (h: typeof first) => `${fmt(h.best.set.weight_kg, 1)}×${h.best.set.reps} (${formatDayMonth(h.date)})`;
    strengthRows.push([
      name,
      set(first),
      fmt(first.best.e1rm, 1),
      set(last),
      fmt(last.best.e1rm, 1),
      signed(((last.best.e1rm - first.best.e1rm) / first.best.e1rm) * 100),
    ]);
  }
  if (strengthRows.length)
    L.push(...table(['Exercise', 'Start best set', 'Start e1RM kg', 'End best set', 'End e1RM kg', 'Δ %'], strengthRows));
  else L.push('No workouts logged in this range.');

  // ----- Body scan -----
  L.push('', '## Latest body scan vs baseline', '');
  const scans = [...data.body_scans].sort((a, b) => a.date.localeCompare(b.date));
  const baseline = scans[0];
  const latest = [...scans].reverse().find((s) => s.date <= range.end);
  if (!baseline) L.push('No body scans recorded.');
  else if (!latest || latest.id === baseline.id) {
    L.push(`Only the baseline scan is recorded (${scanDate(baseline)}).`, '');
    const rows = BODY_SCAN_FIELDS.filter((f) => baseline[f.key] != null).map((f) => [
      `${f.label}${f.unit ? ` (${f.unit})` : ''}`,
      String(baseline[f.key]),
    ]);
    L.push(...table(['Field', 'Baseline'], rows));
  } else {
    const rows = BODY_SCAN_FIELDS.filter((f) => baseline[f.key] != null || latest[f.key] != null).map((f) => {
      const b = baseline[f.key] as number | null;
      const l = latest[f.key] as number | null;
      return [
        `${f.label}${f.unit ? ` (${f.unit})` : ''}`,
        b != null ? String(b) : DASH,
        l != null ? String(l) : DASH,
        b != null && l != null ? signed(l - b) : DASH,
      ];
    });
    L.push(...table(['Field', `Baseline ${scanDate(baseline)}`, `Latest ${scanDate(latest)}`, 'Δ'], rows));
  }

  // ----- Flags -----
  L.push('', '## Flags', '');
  const list = (items: string[]) => (items.length ? items.join(', ') : 'none');
  const lossOf = (w: WeekRow) => (w.changePct == null ? null : -w.changePct);
  const lowLoss = weeks.filter((w) => lossOf(w) != null && lossOf(w)! < WEEKLY_LOSS_LOW_PCT);
  const highLoss = weeks.filter((w) => lossOf(w) != null && lossOf(w)! > WEEKLY_LOSS_HIGH_PCT);
  const weekFlag = (w: WeekRow) => `${w.label} (${signed(w.changePct, 2)}%)`;
  L.push(`- Weeks with loss below ${WEEKLY_LOSS_LOW_PCT}% of bodyweight: ${list(lowLoss.map(weekFlag))}`);
  L.push(`- Weeks with loss above ${WEEKLY_LOSS_HIGH_PCT}% of bodyweight: ${list(highLoss.map(weekFlag))}`);
  L.push(
    `- Days with protein < ${PROTEIN_FLAG_G} g: ${list(
      days.filter((d) => d.food_logged && d.protein_g < PROTEIN_FLAG_G).map((d) => `${formatDayMonth(d.date)} (${fmt(d.protein_g)} g)`),
    )}`,
  );
  L.push(`- Days with no food logged: ${list(days.filter((d) => !d.food_logged).map((d) => formatDayMonth(d.date)))}`);
  const drops: string[] = [];
  for (const name of exerciseNames) {
    const s = strengthStatus(data.workouts, name, data.profile.start_date, range.end);
    if (s?.dropped)
      drops.push(
        `${name} (${signed(s.change_pct)}%: ${fmt(s.latest_e1rm, 1)} kg on ${formatDayMonth(s.latest_date)} vs best ${fmt(s.best_e1rm, 1)} kg on ${formatDayMonth(s.best_date)})`,
      );
  }
  L.push(`- Exercises down >5% est. 1RM vs best this cut: ${list(drops)}`);

  return L.join('\n') + '\n';
}
