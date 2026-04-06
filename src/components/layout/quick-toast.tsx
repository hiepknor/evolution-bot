import { useEffect, useMemo, useState } from 'react';
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
  warn: 'border-warning/40 bg-warning/10 text-warning',
  error: 'border-destructive/40 bg-destructive/10 text-destructive'
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
        return {
          id: entry.id,
          level: entry.level,
          message: entry.message
        };
      }
    }
    return null;
  }, [uiLogs]);
  const [toast, setToast] = useState<ToastView | null>(null);

  useEffect(() => {
    if (!latest) {
      return;
    }
    setToast(latest);

    const timer = window.setTimeout(() => {
      setToast((prev) => (prev?.id === latest.id ? null : prev));
    }, 3400);

    return () => window.clearTimeout(timer);
  }, [latest]);

  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] w-[min(460px,calc(100vw-2rem))]">
      <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur ${toneClass[toast.level]}`}>
        {(() => {
          const Icon = levelIcon[toast.level];
          return <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />;
        })()}
        <span className="leading-5">{toast.message}</span>
      </div>
    </div>
  );
}
