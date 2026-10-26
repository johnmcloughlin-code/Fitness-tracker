import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { seedData } from './lib/seed';
import { todayKey } from './lib/dates';
import type { Goal, Profile, Targets } from './lib/types';

export interface Route {
  path: string;
  segments: string[];
  params: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path, segments: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string) {
  window.location.hash = path;
}

export interface Settings {
  profile: Profile;
  goal: Goal;
  targets: Targets;
  last_full_export_at: string | null;
  installed_at: string | null;
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const rows = await db.settings.toArray();
    const m = new Map(rows.map((r) => [r.key, r.value]));
    const seed = seedData();
    return {
      profile: (m.get('profile') as Profile) ?? seed.profile,
      goal: (m.get('goal') as Goal) ?? seed.goal,
      targets: (m.get('targets') as Targets) ?? seed.targets,
      last_full_export_at: (m.get('last_full_export_at') as string) ?? null,
      installed_at: (m.get('installed_at') as string) ?? null,
    };
  });
}

/** Today's date key, refreshed when the app comes back to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const refresh = () => setToday(todayKey());
    document.addEventListener('visibilitychange', refresh);
    const id = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(id);
    };
  }, []);
  return today;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
