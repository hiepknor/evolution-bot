import { useEffect, useRef, useState } from 'react';
import { ConnectionPanel } from '@/components/connection/connection-panel';
import { ComposerPanel } from '@/components/composer/composer-panel';
import { HistoryPanel } from '@/components/campaigns/history-panel';
import { OperationsPanel } from '@/components/composer/operations-panel';
import { GroupsPanel } from '@/components/groups/groups-panel';
import { ActivityLogPanel } from '@/components/logs/activity-log-panel';
import { PreviewPanel } from '@/components/preview/preview-panel';
import type { ScreenFlag } from '@/hooks/use-screen-flag';
import { useSettingsStore } from '@/stores/use-settings-store';

type LeftTab = 'content' | 'operations' | 'connection' | 'history';
const LEFT_TABS: Array<{ id: LeftTab; label: string }> = [
  { id: 'content', label: 'Nội dung' },
  { id: 'operations', label: 'Vận hành' },
  { id: 'connection', label: 'Kết nối' },
  { id: 'history', label: 'Lịch sử' }
];

interface DashboardPageProps {
  screenFlag: ScreenFlag;
}

export function DashboardPage({ screenFlag }: DashboardPageProps): JSX.Element {
  const badgeState = useSettingsStore((state) => state.badgeState);
  const providerMode = useSettingsStore((state) => state.settings?.providerMode);
  const [activeTab, setActiveTab] = useState<LeftTab>('content');
  const initializedRef = useRef(false);
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
  const tabGridClassName = isSmallScreen
    ? 'grid grid-cols-2 gap-2 sm:grid-cols-4'
    : isFullScreen
      ? 'grid grid-cols-4 gap-2'
      : 'grid grid-cols-2 gap-2 lg:grid-cols-4';
  const contentClassName = isSmallScreen ? 'overflow-visible' : 'min-h-0 flex-1 overflow-auto';
  const rightSectionClassName = isSmallScreen
    ? 'grid grid-cols-1 gap-3'
    : isFullScreen
      ? 'grid min-h-0 grid-rows-[minmax(0,1.35fr)_minmax(0,1fr)] gap-5 overflow-hidden'
      : 'grid min-h-0 grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 overflow-hidden';
  const rightBottomClassName = isSmallScreen
    ? 'grid grid-cols-1 gap-3'
    : isFullScreen
      ? 'grid min-h-0 grid-cols-2 gap-5'
      : 'grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2';

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    if (badgeState !== 'connected') {
      setActiveTab('connection');
    }
  }, [badgeState]);

  return (
    <main className={mainClassName}>
      <section className={leftSectionClassName}>
        <div className={tabGridClassName}>
          {LEFT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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

        {providerMode !== 'mock' && badgeState !== 'connected' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <span>Chưa kết nối instance. Mở tab Kết nối để tiếp tục thao tác mạng.</span>
            <button
              type="button"
              className="rounded border border-warning/45 bg-warning/15 px-2 py-1 font-medium text-warning hover:bg-warning/25"
              onClick={() => setActiveTab('connection')}
            >
              Mở Kết nối
            </button>
          </div>
        ) : null}

        <div className={contentClassName}>
          {activeTab === 'content' ? <ComposerPanel /> : null}
          {activeTab === 'operations' ? <OperationsPanel /> : null}
          {activeTab === 'connection' ? <ConnectionPanel /> : null}
          {activeTab === 'history' ? <HistoryPanel /> : null}
        </div>
      </section>

      <section className={rightSectionClassName}>
        <GroupsPanel />
        <div className={rightBottomClassName}>
          <PreviewPanel />
          <ActivityLogPanel />
        </div>
      </section>
    </main>
  );
}
