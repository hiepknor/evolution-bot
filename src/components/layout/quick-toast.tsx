import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useActivityLogStore } from '@/stores/use-activity-log-store';

interface ToastView {
  id: string;
  level: 'warn' | 'error';
  message: string;
}

const isToastLevel = (level: string): level is ToastView['level'] =>
  level === 'warn' || level === 'error';

const toneClass: Record<ToastView['level'], string> = {
  warn: 'border-warning/35 bg-warning/[0.08] text-warning',
  error: 'border-destructive/35 bg-destructive/[0.08] text-destructive'
};

const levelIcon: Record<ToastView['level'], LucideIcon> = {
  warn: AlertTriangle,
  error: AlertCircle
};

export function QuickToast(): JSX.Element | null {
  const uiLogs = useActivityLogStore((state) => state.uiLogs);
  const latest = useMemo<ToastView | null>(() => {
    for (let i = uiLogs.length - 1; i >= 0; i -= 1) {
      const entry = uiLogs[i];
      if (entry && isToastLevel(entry.level)) {
        return { id: entry.id, level: entry.level, message: entry.message };
      }
    }
    return null;
  }, [uiLogs]);

  const [toast, setToast] = useState<ToastView | null>(null);
  const lastShownToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!latest || lastShownToastIdRef.current === latest.id) return;
    lastShownToastIdRef.current = latest.id;
    setToast(latest);
    const timer = window.setTimeout(() => {
      setToast((prev) => (prev?.id === latest.id ? null : prev));
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [latest]);

  if (!toast) return null;

  const Icon = levelIcon[toast.level];

  return (
    <div className="pointer-events-none fixed right-4 top-14 z-[70] w-[min(420px,calc(100vw-2rem))]">
      <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm ${toneClass[toast.level]}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="leading-5">{toast.message}</span>
      </div>
    </div>
  );
}
