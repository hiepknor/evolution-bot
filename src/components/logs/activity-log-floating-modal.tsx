import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { ActivityLogPanel } from '@/components/logs/activity-log-panel';
import { cn } from '@/lib/utils/cn';
import type { ScreenFlag } from '@/hooks/use-screen-flag';

const CLOSE_ANIMATION_MS = 180;

interface ActivityLogFloatingModalProps {
  screenFlag: ScreenFlag;
}

export function ActivityLogFloatingModal({ screenFlag }: ActivityLogFloatingModalProps): JSX.Element {
  const isSmallScreen = screenFlag === 'small-screen';
  const [open, setOpen] = useState<boolean>(false);
  const [shouldRender, setShouldRender] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

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
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (isSmallScreen && open) {
      setOpen(false);
    }
  }, [isSmallScreen, open]);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Nhật ký hoạt động"
          aria-label="Mở nhật ký hoạt động"
          className={cn(
            'group fixed z-40 flex items-center justify-center transition-all duration-150',
            isSmallScreen
              ? [
                  'bottom-24 right-4 h-10 w-10 rounded-xl',
                  'border border-border/50 bg-card/90 backdrop-blur-sm',
                  'text-muted-foreground shadow-[0_8px_24px_-10px_rgba(0,0,0,0.55)]',
                  'hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
                ].join(' ')
              : [
                  'right-0 top-1/2 h-11 w-8 -translate-y-1/2',
                  'rounded-l-xl rounded-r-none border border-r-0 border-border/35',
                  'bg-card/80 backdrop-blur-sm',
                  'text-muted-foreground/55',
                  'shadow-[-3px_0_12px_-4px_rgba(0,0,0,0.4)]',
                  'hover:border-primary/30 hover:bg-card/95 hover:text-primary/80 hover:w-9'
                ].join(' ')
          )}
        >
          <FileText className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110" />
        </button>
      ) : null}

      {shouldRender ? (
        <>
          {isSmallScreen ? (
            <button
              type="button"
              aria-label="Đóng nhật ký hoạt động"
              className={cn(
                'fixed inset-0 z-30 bg-background/50 transition-opacity duration-200',
                isVisible ? 'opacity-100' : 'opacity-0'
              )}
              onClick={() => setOpen(false)}
            />
          ) : null}
          <section
            className={cn(
              'fixed z-40 overflow-hidden transition-all duration-200',
              isSmallScreen
                ? 'inset-x-3 bottom-24 h-[min(68dvh,620px)]'
                : 'bottom-20 right-3 top-24 w-[min(460px,calc(100vw-1.5rem))]',
              isVisible
                ? 'translate-x-0 translate-y-0 opacity-100'
                : isSmallScreen
                  ? 'translate-y-6 opacity-0'
                  : 'translate-x-full opacity-0'
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Nhật ký hoạt động"
          >
            <ActivityLogPanel
              compact={!isSmallScreen}
              onRequestClose={() => setOpen(false)}
              className={
                isSmallScreen
                  ? 'h-full rounded-2xl border-border/60 bg-card shadow-[0_20px_44px_-28px_rgba(0,0,0,0.88)]'
                  : 'h-full rounded-2xl border-border/50 bg-card shadow-[-18px_0_40px_-30px_rgba(0,0,0,0.86)]'
              }
            />
          </section>
        </>
      ) : null}
    </>
  );
}
