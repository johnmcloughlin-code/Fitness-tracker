import { formatDateLong } from '../lib/dates';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl bg-card p-4', className)}>{children}</section>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {right}
    </div>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'min-h-11 rounded-xl px-4 font-semibold transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-ink',
        variant === 'secondary' && 'bg-card2 text-slate-100',
        variant === 'ghost' && 'text-accent',
        variant === 'danger' && 'bg-bad/15 text-bad',
        className,
      )}
    />
  );
}

/** Parse a user-typed number, accepting a comma decimal separator. */
export function parseNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

export function NumInput({
  value,
  onChange,
  label,
  suffix,
  integer,
  className,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  suffix?: string;
  integer?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const input = (
    <div className={cx('flex items-center rounded-xl bg-card2 px-3', className)}>
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular min-h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted/60"
        {...rest}
      />
      {suffix && <span className="pl-1 text-sm text-muted">{suffix}</span>}
    </div>
  );
  if (!label) return input;
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {input}
    </label>
  );
}

export function TextInput({
  label,
  className,
  ...rest
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const input = (
    <input
      type="text"
      {...rest}
      className={cx('min-h-11 w-full rounded-xl bg-card2 px-3 outline-none placeholder:text-muted/60', className)}
    />
  );
  if (!label) return input;
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {input}
    </label>
  );
}

/** Native date picker (opens the iOS wheel) that always displays DD/MM/YYYY, whatever the device locale. */
export function DateInput({
  value,
  onChange,
  label,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <span className="relative flex min-h-11 items-center rounded-xl bg-card2 px-3">
        <span className="tabular">{formatDateLong(value)}</span>
        <input
          type="date"
          value={value}
          max={max}
          aria-label={label}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </span>
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  const el = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="min-h-11 w-full rounded-xl bg-card2 px-3 outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!label) return el;
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {el}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-card2 p-1">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 flex-1 rounded-lg px-2 text-sm font-medium',
            value === o.value ? 'bg-accent text-accent-ink' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value, target, label, unit, overIsGood }: { value: number; target: number; label: string; unit: string; overIsGood?: boolean }) {
  const pct = target > 0 ? Math.min(value / target, 1.2) : 0;
  const over = value > target;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular">
          {Math.round(value)} / {target} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-card2">
        <div
          className={cx('h-full rounded-full', over && !overIsGood ? 'bg-warn' : 'bg-accent')}
          style={{ width: `${(Math.min(pct, 1) * 100).toFixed(1)}%` }}
        />
      </div>
    </div>
  );
}

/** Bottom sheet modal. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-4 pb-2 pt-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-2xl text-muted" aria-label="Close">
            ×
          </button>
        </div>
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}

// ----- Toasts -----

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(text: string, action?: ToastMsg['action']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, action?: ToastMsg['action']) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, action });
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4" role="status">
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 shadow-lg">
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="font-bold text-emerald-700"
                onClick={() => {
                  toast.action!.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function haptic(ms = 30) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported (iOS Safari) */
  }
}
