import { useEffect, useRef, useState } from 'react';
import { Loader2, Settings2, Wifi, X } from 'lucide-react';
import { ConnectionPanel } from '@/components/connection/connection-panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { getConnectionStatusPresentation } from '@/lib/connection/connection-status';
import { useSettingsStore } from '@/stores/use-settings-store';

const CLOSE_ANIMATION_MS = 180;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ConnectionSettingsModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function ConnectionSettingsModal({
  open,
  onOpenChange
}: ConnectionSettingsModalProps): JSX.Element | null {
  const badgeState = useSettingsStore((state) => state.badgeState);
  const statusMessage = useSettingsStore((state) => state.statusMessage);
  const modalRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const [shouldRender, setShouldRender] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const connectionStatus = getConnectionStatusPresentation(badgeState, statusMessage);
  const statusBadgeClass =
    connectionStatus.tone === 'success'
      ? 'border-success/45 bg-success/15 text-success'
      : connectionStatus.tone === 'warning'
        ? 'border-warning/45 bg-warning/15 text-warning'
        : connectionStatus.tone === 'destructive'
          ? 'border-destructive/45 bg-destructive/15 text-destructive'
          : 'border-border/65 bg-muted/25 text-muted-foreground';

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const frameId = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frameId);
    }

    setIsVisible(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (open || !shouldRender || isVisible) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setShouldRender(false);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timerId);
  }, [open, shouldRender, isVisible]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const modalElement = modalRef.current;
      if (!modalElement) {
        return;
      }

      const focusableElements = Array.from(
        modalElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0]!;
      const last = focusableElements[focusableElements.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const isInsideModal = active ? modalElement.contains(active) : false;

      if (event.shiftKey) {
        if (!isInsideModal || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!isInsideModal || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange, shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender || !isVisible) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, [isVisible, shouldRender]);

  useEffect(() => {
    if (open || shouldRender) {
      return;
    }

    const previous = previousFocusedElementRef.current;
    if (!previous || !document.contains(previous)) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      previous.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, [open, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center p-0 transition-opacity duration-200 sm:items-center sm:p-4',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt kết nối"
    >
      <button
        type="button"
        aria-label="Đóng cài đặt kết nối"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <section
        ref={modalRef}
        className={cn(
          'relative flex h-[100dvh] w-full flex-col overflow-hidden border border-border/70 bg-background shadow-[0_24px_80px_-36px_rgba(0,0,0,0.95)] transition-all duration-200',
          'rounded-none sm:h-auto sm:max-h-[min(92dvh,920px)] sm:max-w-[min(960px,95vw)] sm:rounded-2xl',
          isVisible ? 'translate-y-0 sm:scale-100' : 'translate-y-6 sm:scale-[0.985]'
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-background via-background to-accent/10 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-3 text-[hsl(var(--text-strong))]">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/25">
                <Settings2 className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight">Cài đặt kết nối</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Cấu hình Evolution API và kiểm tra trạng thái kết nối instance.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium',
                statusBadgeClass
              )}
              title={statusMessage}
            >
              {badgeState === 'checking' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {connectionStatus.label}
            </div>
            <Button
              ref={closeButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg border border-border/50"
              aria-label="Đóng cài đặt kết nối"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_15%_10%,rgba(8,132,148,0.12),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(10,79,118,0.2),transparent_36%)] p-4 pb-5 sm:p-5">
          <ConnectionPanel />
        </div>
      </section>
    </div>
  );
}
