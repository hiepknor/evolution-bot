import type React from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Eye, PenLine, Zap } from 'lucide-react';
import { ComposerPanel } from '@/components/composer/composer-panel';
import { OperationsPanel } from '@/components/composer/operations-panel';
import { GroupsPanel } from '@/components/groups/groups-panel';
import { PreviewPanel } from '@/components/preview/preview-panel';
import type { ScreenFlag } from '@/hooks/use-screen-flag';

const HistoryPanel = lazy(async () => {
  const module = await import('@/components/campaigns/history-panel');
  return { default: module.HistoryPanel };
});

const ActivityLogFloatingModal = lazy(async () => {
  const module = await import('@/components/logs/activity-log-floating-modal');
  return { default: module.ActivityLogFloatingModal };
});

type LeftTab = 'content' | 'operations' | 'history';
const LEFT_TABS: Array<{ id: LeftTab; label: string; icon: React.ElementType }> = [
  { id: 'content', label: 'Nội dung', icon: PenLine },
  { id: 'operations', label: 'Vận hành', icon: Zap },
  { id: 'history', label: 'Lịch sử', icon: Clock }
];

interface DashboardPageProps {
  screenFlag: ScreenFlag;
  onOpenConnectionSettings: () => void;
}

export function DashboardPage({ screenFlag, onOpenConnectionSettings }: DashboardPageProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<LeftTab>('content');
  const [contentPreviewExpanded, setContentPreviewExpanded] = useState<boolean>(screenFlag !== 'small-screen');
  const isSmallScreen = screenFlag === 'small-screen';
  const isFullScreen = screenFlag === 'full-screen';

  const fullScreenDensity = isFullScreen ? 'compact' : 'comfortable';

  const mainClassName = isSmallScreen
    ? 'grid flex-1 grid-cols-1 gap-3 overflow-auto p-3 transition-[grid-template-columns,gap,padding] duration-300 ease-out sm:gap-4 sm:p-4'
    : isFullScreen
      ? 'grid flex-1 grid-cols-[380px_minmax(0,1fr)] gap-4 overflow-hidden px-4 py-4 transition-[grid-template-columns,gap,padding] duration-300 ease-out'
      : 'grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 transition-[grid-template-columns,gap,padding] duration-300 ease-out lg:grid-cols-[380px_minmax(0,1fr)]';
  const leftSectionClassName = isSmallScreen
    ? 'flex flex-col gap-3 transition-[gap] duration-300 ease-out'
    : isFullScreen
      ? 'flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden transition-[gap] duration-300 ease-out'
      : 'flex min-h-0 flex-col gap-4 overflow-hidden transition-[gap] duration-300 ease-out';
  const tabGridClassName = 'flex w-full rounded-lg border border-border/35 bg-background/55 p-1 shadow-sm backdrop-blur-sm';
  const contentClassName = isSmallScreen ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto';
  const rightSectionClassName = isSmallScreen
    ? 'grid grid-cols-1 gap-3 transition-[gap] duration-300 ease-out'
    : isFullScreen
      ? 'flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden transition-[gap] duration-300 ease-out'
      : 'flex min-h-0 flex-col gap-4 overflow-hidden transition-[gap] duration-300 ease-out';

  useEffect(() => {
    if (screenFlag === 'small-screen') {
      setContentPreviewExpanded(false);
      return;
    }
    setContentPreviewExpanded(true);
  }, [screenFlag]);

  return (
    <>
      <main className={mainClassName}>
        <section className={leftSectionClassName}>
          <div className={tabGridClassName} role="tablist" aria-label="Điều hướng khu vực bên trái">
            {LEFT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`left-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`left-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className={contentClassName}>
            {activeTab === 'content' ? (
              <div id="left-panel-content" role="tabpanel" aria-labelledby="left-tab-content" className="space-y-4">
                <ComposerPanel />
                <div className="space-y-2">
                  {contentPreviewExpanded ? <PreviewPanel mode="embedded" /> : null}
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                    onClick={() => setContentPreviewExpanded((prev) => !prev)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                      Xem trước trực tiếp
                    </span>
                    {contentPreviewExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}
            {activeTab === 'operations' ? (
              <div id="left-panel-operations" role="tabpanel" aria-labelledby="left-tab-operations">
                <OperationsPanel />
              </div>
            ) : null}
            {activeTab === 'history' ? (
              <div id="left-panel-history" role="tabpanel" aria-labelledby="left-tab-history">
                <Suspense fallback={<div className="p-3 text-sm text-muted-foreground">Đang tải lịch sử...</div>}>
                  <HistoryPanel />
                </Suspense>
              </div>
            ) : null}
          </div>
        </section>

        <section className={rightSectionClassName}>
          <GroupsPanel onOpenConnectionSettings={onOpenConnectionSettings} density={fullScreenDensity} />
        </section>
      </main>

      <Suspense fallback={null}>
        <ActivityLogFloatingModal screenFlag={screenFlag} />
      </Suspense>
    </>
  );
}
