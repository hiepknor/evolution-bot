import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { ActivityLogPanel } from '@/components/logs/activity-log-panel';
import { Button } from '@/components/ui/button';
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
        <Button
          type="button"
          variant="secondary"
          className={cn(
            'fixed z-40 border border-border/55 bg-card text-xs text-foreground shadow-[0_16px_34px_-28px_rgba(0,0,0,0.82)]',
            isSmallScreen
              ? 'bottom-24 right-4 h-10 rounded-full px-4'
              : 'right-0 top-1/2 h-14 w-10 -translate-y-1/2 rounded-l-xl rounded-r-none border-r-0 px-0'
          )}
          onClick={() => setOpen(true)}
          title="Mở nhật ký hoạt động"
        >
          {isSmallScreen ? (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Nhật ký hoạt động
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span className="sr-only">Nhật ký hoạt động</span>
            </>
          )}
        </Button>
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
