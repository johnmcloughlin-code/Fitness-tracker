import { useRoute } from './hooks';
import { ToastProvider, cx } from './components/ui';
import TodayScreen from './screens/TodayScreen';
import FoodScreen from './screens/FoodScreen';
import WeightScreen from './screens/WeightScreen';
import TrainScreen from './screens/TrainScreen';
import WorkoutScreen from './screens/WorkoutScreen';
import MoreScreen from './screens/MoreScreen';
import HistoryScreen from './screens/HistoryScreen';
import BodyScansScreen from './screens/BodyScansScreen';
import ExportScreen from './screens/ExportScreen';
import SettingsScreen from './screens/SettingsScreen';

const TABS = [
  { path: '/', label: 'Today', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { path: '/food', label: 'Food', icon: 'M4 3v8a3 3 0 006 0V3M7 3v18M17 3c-2 2-3 5-3 8h3v10' },
  { path: '/weight', label: 'Weight', icon: 'M4 18l5-5 4 3 7-8' },
  { path: '/train', label: 'Train', icon: 'M2 10v4M5 7v10M19 7v10M22 10v4M5 12h14' },
  { path: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

const MORE_PATHS = ['/more', '/history', '/scans', '/export', '/settings'];

export default function App() {
  const route = useRoute();
  const top = '/' + (route.segments[0] ?? '');
  let screen;
  switch (top) {
    case '/food':
      screen = <FoodScreen dateParam={route.params.get('date')} />;
      break;
    case '/weight':
      screen = <WeightScreen />;
      break;
    case '/train':
      screen = <TrainScreen />;
      break;
    case '/workout':
      screen = <WorkoutScreen id={route.segments[1]} />;
      break;
    case '/more':
      screen = <MoreScreen />;
      break;
    case '/history':
      screen = <HistoryScreen />;
      break;
    case '/scans':
      screen = <BodyScansScreen />;
      break;
    case '/export':
      screen = <ExportScreen />;
      break;
    case '/settings':
      screen = <SettingsScreen />;
      break;
    default:
      screen = <TodayScreen />;
  }
  const active = top === '/workout' ? '/train' : MORE_PATHS.includes(top) ? '/more' : top;
  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh max-w-md">
        <main className="pt-safe px-4 pb-28">{screen}</main>
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-md">
            {TABS.map((t) => (
              <a
                key={t.path}
                href={`#${t.path}`}
                className={cx(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active === t.path ? 'text-accent' : 'text-muted',
                )}
                aria-current={active === t.path ? 'page' : undefined}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </ToastProvider>
  );
}
