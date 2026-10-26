import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db/db';
import { formatDate } from '../lib/dates';
import { BODY_SCAN_FIELDS, type BodyScan } from '../lib/types';
import { useToday } from '../hooks';
import { Button, Card, DateInput, NumInput, SectionTitle, TextInput, parseNum, useToast } from '../components/ui';

type NumKey = Exclude<keyof BodyScan, 'id' | 'date' | 'device'>;

export default function BodyScansScreen() {
  const today = useToday();
  const toast = useToast();
  const scans = useLiveQuery(() => db.body_scans.orderBy('date').toArray(), []);
  const [date, setDate] = useState(today);
  const [device, setDevice] = useState('Evolt 360');
  const [vals, setVals] = useState<Record<string, string>>({});
  if (!scans) return null;
  const baseline = scans[0];
  const anyValue = BODY_SCAN_FIELDS.some((f) => parseNum(vals[f.key] ?? '') != null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Body scans</h1>
      <Card>
        <SectionTitle>New scan or measurement</SectionTitle>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!anyValue) return;
            const scan = { id: uid(), date, device: device.trim() || null } as BodyScan;
            for (const f of BODY_SCAN_FIELDS) (scan as unknown as Record<string, number | null>)[f.key] = parseNum(vals[f.key] ?? '');
            await db.body_scans.add(scan);
            setVals({});
            toast('Scan saved');
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <DateInput label="Date" value={date} max={today} onChange={setDate} />
            <TextInput label="Device (optional)" value={device} onChange={(e) => setDevice(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BODY_SCAN_FIELDS.map((f) => (
              <NumInput
                key={f.key}
                label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
                value={vals[f.key] ?? ''}
                onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))}
              />
            ))}
          </div>
          <p className="text-xs text-muted">All fields optional. For a waist-only check, just fill in Waist.</p>
          <Button type="submit" variant="primary" className="w-full" disabled={!anyValue}>
            Save scan
          </Button>
        </form>
      </Card>

      {[...scans].reverse().map((s) => (
        <Card key={s.id}>
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold">
              {formatDate(s.date)}
              {s.device && <span className="text-sm font-normal text-muted"> · {s.device}</span>}
              {s.id === baseline?.id && <span className="ml-2 rounded bg-card2 px-1.5 text-xs text-muted">baseline</span>}
            </div>
            <button
              type="button"
              className="min-h-11 px-2 text-sm text-muted"
              onClick={async () => {
                if (!window.confirm(`Delete the scan from ${formatDate(s.date)}?`)) return;
                await db.body_scans.delete(s.id);
              }}
            >
              Delete
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {BODY_SCAN_FIELDS.filter((f) => s[f.key] != null).map((f) => {
              const v = s[f.key as NumKey] as number;
              const b = baseline && baseline.id !== s.id ? (baseline[f.key as NumKey] as number | null) : null;
              const d = b != null ? v - b : null;
              return (
                <div key={f.key} className="flex justify-between gap-2">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="tabular">
                    {v}
                    {f.unit && ` ${f.unit}`}
                    {d != null && <span className="ml-1 text-xs text-muted">({d > 0 ? '+' : ''}{d.toFixed(1)})</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      ))}
    </div>
  );
}
