const LINKS = [
  { href: '#/history', label: 'History', hint: 'Past days and adherence' },
  { href: '#/scans', label: 'Body scans', hint: 'Evolt scans and waist' },
  { href: '#/export', label: 'Export & import', hint: 'Copy for Claude, JSON, CSV' },
  { href: '#/settings', label: 'Settings', hint: 'Targets, templates, profile, data' },
];

export default function MoreScreen() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">More</h1>
      <ul className="space-y-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="flex min-h-14 items-center justify-between rounded-2xl bg-card px-4 py-3">
              <span>
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-sm text-muted">{l.hint}</span>
              </span>
              <span className="text-muted">›</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
