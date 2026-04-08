import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ComposerPanel } from '@/components/composer/composer-panel';
import { HistoryPanel } from '@/components/campaigns/history-panel';
import { OperationsPanel } from '@/components/composer/operations-panel';
import { GroupsPanel } from '@/components/groups/groups-panel';
import { ActivityLogFloatingModal } from '@/components/logs/activity-log-floating-modal';
import { PreviewPanel } from '@/components/preview/preview-panel';
import type { ScreenFlag } from '@/hooks/use-screen-flag';

type LeftTab = 'content' | 'operations' | 'history';
const LEFT_TABS: Array<{ id: LeftTab; label: string }> = [
  { id: 'content', label: 'Nội dung' },
  { id: 'operations', label: 'Vận hành' },
  { id: 'history', label: 'Lịch sử' }
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

  const mainClassName = isSmallScreen
    ? 'grid flex-1 grid-cols-1 gap-3 overflow-auto p-3 sm:gap-4 sm:p-4'
    : isFullScreen
      ? 'grid flex-1 grid-cols-[minmax(420px,34%)_minmax(0,1fr)] gap-5 overflow-hidden px-6 py-5'
      : 'grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[380px_minmax(0,1fr)]';
  const leftSectionClassName = isSmallScreen
    ? 'flex flex-col gap-3'
    : isFullScreen
      ? 'flex min-h-0 flex-col gap-5 overflow-hidden'
      : 'flex min-h-0 flex-col gap-4 overflow-hidden';
  const tabGridClassName = 'grid min-w-0 grid-cols-3 gap-2';
  const contentClassName = isSmallScreen ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto';
  const rightSectionClassName = isSmallScreen
    ? 'grid grid-cols-1 gap-3'
    : isFullScreen
      ? 'flex min-h-0 flex-col gap-5 overflow-hidden'
      : 'flex min-h-0 flex-col gap-4 overflow-hidden';

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
            {LEFT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`left-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`left-panel-${tab.id}`}
                className={`h-9 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  activeTab === tab.id
                    ? 'border-primary/60 bg-primary/90 text-primary-foreground shadow-[0_8px_22px_-16px_hsl(var(--primary))]'
                    : 'border-border/60 bg-secondary/80 text-secondary-foreground hover:border-border/80 hover:bg-muted/60'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={contentClassName}>
            {activeTab === 'content' ? (
              <div id="left-panel-content" role="tabpanel" aria-labelledby="left-tab-content" className="space-y-4">
                <ComposerPanel />
                <div className="space-y-2">
                  {contentPreviewExpanded ? <PreviewPanel mode="embedded" /> : null}
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/35"
                    onClick={() => setContentPreviewExpanded((prev) => !prev)}
                  >
                    <span>Xem trước trực tiếp</span>
                    <span className="inline-flex items-center gap-1">
                      {contentPreviewExpanded ? (
                        <>
                          Thu gọn <ChevronUp className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          Mở xem trước <ChevronDown className="h-3.5 w-3.5" />
                        </>
                      )}
                    </span>
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
                <HistoryPanel />
              </div>
            ) : null}
          </div>
        </section>

        <section className={rightSectionClassName}>
          <GroupsPanel onOpenConnectionSettings={onOpenConnectionSettings} />
        </section>
      </main>

      <ActivityLogFloatingModal screenFlag={screenFlag} />
    </>
  );
}
