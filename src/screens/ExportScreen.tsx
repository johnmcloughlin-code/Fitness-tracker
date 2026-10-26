import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { strToU8, zipSync } from 'fflate';
import { loadAll, writeAll } from '../db/db';
import { markExported } from '../db/actions';
import { addDays, formatDate } from '../lib/dates';
import { buildClaudeReport } from '../lib/report';
import { buildCsvBundle, buildFullExport, exportFilename, validateImport, type ImportResult } from '../lib/exporter';
import { copyText, saveFile } from '../lib/download';
import { useSettings, useToday } from '../hooks';
import { Button, Card, DateInput, SectionTitle, Segmented, cx, useToast } from '../components/ui';

type Preset = '7' | '14' | 'cut' | 'custom';

export default function ExportScreen() {
  const today = useToday();
  const settings = useSettings();
  // Data is preloaded so "Copy" can write to the clipboard synchronously inside the tap (required by iOS Safari).
  const data = useLiveQuery(loadAll, []);
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>('7');
  const [customStart, setCustomStart] = useState(addDays(today, -27));
  const [customEnd, setCustomEnd] = useState(today);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!data || !settings) return null;

  const cutStart = data.profile.start_date;
  const range =
    preset === '7'
      ? { start: addDays(today, -6), end: today }
      : preset === '14'
        ? { start: addDays(today, -13), end: today }
        : preset === 'cut'
          ? { start: cutStart, end: today < data.goal.end_date ? today : data.goal.end_date }
          : { start: customStart, end: customEnd };
  const validRange = range.start <= range.end;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Export</h1>

      <Card className="space-y-3">
        <SectionTitle>Date range</SectionTitle>
        <Segmented
          value={preset}
          onChange={(p) => {
            setPreset(p);
            setReport(null);
          }}
          options={[
            { value: '7', label: '7 d' },
            { value: '14', label: '14 d' },
            { value: 'cut', label: 'Cut' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <DateInput label="From" value={customStart} max={today} onChange={setCustomStart} />
            <DateInput label="To" value={customEnd} max={today} onChange={setCustomEnd} />
          </div>
        )}
        <p className="text-sm text-muted">
          {validRange ? `${formatDate(range.start)} to ${formatDate(range.end)}` : 'Start date must be before end date.'}
        </p>
      </Card>

      <Card className="space-y-2">
        <SectionTitle>For Claude</SectionTitle>
        <Button
          variant="primary"
          className="w-full"
          disabled={!validRange}
          onClick={async () => {
            const md = buildClaudeReport(data, range, today);
            setReport(md);
            const ok = await copyText(md);
            setCopied(ok);
            toast(ok ? 'Report copied. Paste it into Claude.' : 'Could not copy automatically. Use Download .md.');
          }}
        >
          Copy for Claude
        </Button>
        {report && (
          <>
            <div className={cx('text-sm', copied ? 'text-accent' : 'text-warn')} data-testid="copy-status">
              {copied ? `✓ Copied ${report.split('\n').length} lines to the clipboard` : 'Not copied: download it instead'}
            </div>
            <Button className="w-full" onClick={() => saveFile(report, `cut-tracker-report-${range.start}-to-${range.end}.md`, 'text/markdown')}>
              Download .md
            </Button>
            <pre className="max-h-72 overflow-auto rounded-xl bg-card2 p-3 text-[11px] leading-snug whitespace-pre text-slate-300" data-testid="report-preview">
              {report}
            </pre>
          </>
        )}
      </Card>

      <Card className="space-y-2">
        <SectionTitle>Backups (all data)</SectionTitle>
        <Button
          className="w-full"
          onClick={async () => {
            const json = JSON.stringify(buildFullExport(data, new Date().toISOString()), null, 2);
            await saveFile(json, exportFilename('json', today), 'application/json');
            await markExported();
            toast('Full JSON exported');
          }}
        >
          Full JSON
        </Button>
        <Button
          className="w-full"
          onClick={async () => {
            const files = buildCsvBundle(data);
            const zip = zipSync(Object.fromEntries(Object.entries(files).map(([n, s]) => [n, strToU8(s)])));
            await saveFile(zip, exportFilename('zip', today), 'application/zip');
            toast('CSV bundle exported');
          }}
        >
          CSV bundle (.zip)
        </Button>
        <p className="text-xs text-muted">
          Last full export: {settings.last_full_export_at ? formatDate(settings.last_full_export_at.slice(0, 10)) : 'never'}. The JSON file is lossless and can be
          imported back.
        </p>
      </Card>

      <ImportCard />
    </div>
  );
}

function ImportCard() {
  const toast = useToast();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  return (
    <Card className="space-y-3">
      <SectionTitle>Import</SectionTitle>
      <input
        key={inputKey}
        type="file"
        accept="application/json,.json"
        aria-label="Import file"
        className="block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-card2 file:px-4 file:font-semibold file:text-slate-100"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            setResult(validateImport(JSON.parse(await file.text())));
          } catch {
            setResult({ ok: false, errors: ['That file is not valid JSON.'] });
          }
        }}
      />
      {result && !result.ok && (
        <div className="rounded-xl bg-bad/15 p-3 text-sm text-bad" role="alert">
          <div className="font-semibold">Can't import this file:</div>
          <ul className="mt-1 list-disc pl-5">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && (
        <div className="space-y-3">
          <div className="rounded-xl bg-card2 p-3 text-sm">
            <div className="mb-1 font-semibold">
              Export from {result.exported_at ? formatDate(result.exported_at.slice(0, 10)) : 'unknown date'}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 text-muted">
              {Object.entries(result.counts).map(([k, n]) => (
                <li key={k} className="flex justify-between">
                  <span>{k.replace(/_/g, ' ')}</span>
                  <span className="tabular">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'merge', label: 'Merge' },
              { value: 'replace', label: 'Replace all' },
            ]}
          />
          <p className="text-xs text-muted">
            {mode === 'merge'
              ? 'Merge adds the file’s records and overwrites ones with the same id/date. Nothing on this phone is deleted. Profile, goal and targets come from the file.'
              : 'Replace deletes everything on this phone first, then restores the file exactly.'}
          </p>
          <Button
            variant={mode === 'replace' ? 'danger' : 'primary'}
            className="w-full"
            disabled={busy}
            onClick={async () => {
              if (mode === 'replace' && !window.confirm('Replace ALL data on this phone with this file?')) return;
              setBusy(true);
              await writeAll(result.data, mode);
              setBusy(false);
              setResult(null);
              setInputKey((k) => k + 1);
              toast(mode === 'merge' ? 'Import merged' : 'Data replaced from file');
            }}
          >
            {mode === 'merge' ? 'Import and merge' : 'Replace all data'}
          </Button>
        </div>
      )}
    </Card>
  );
}
