import { useEffect } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppErrorBoundary } from '@/components/layout/app-error-boundary';
import { FooterStatus } from '@/components/layout/footer-status';
import { QuickToast } from '@/components/layout/quick-toast';
import { DashboardPage } from '@/pages/dashboard-page';
import { initDb } from '@/lib/db/database';
import { campaignsRepo } from '@/lib/db/repositories';
import { useScreenFlag } from '@/hooks/use-screen-flag';
import { useSettingsStore } from '@/stores/use-settings-store';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useCampaignStore } from '@/stores/use-campaign-store';

export default function App(): JSX.Element {
  const loadSettings = useSettingsStore((state) => state.load);
  const loadGroups = useGroupsStore((state) => state.loadCached);
  const loadHistory = useCampaignStore((state) => state.loadHistory);
  const restoreLatestCampaign = useCampaignStore((state) => state.restoreLatestCampaign);
  const screenFlag = useScreenFlag();

  useEffect(() => {
    const boot = async () => {
      try {
        await initDb();
        await campaignsRepo.recoverInterrupted();
        await Promise.all([loadSettings(), loadGroups(), loadHistory()]);
        await restoreLatestCampaign();
      } catch (error) {
        // Keep UI alive even if local DB init fails.
        // Details are visible in devtools for troubleshooting.
        console.error('Failed to initialize application', error);
      }
    };

    void boot();
  }, [loadGroups, loadHistory, loadSettings, restoreLatestCampaign]);

  return (
    <AppErrorBoundary>
      <div className={`flex h-screen flex-col bg-background text-foreground ${screenFlag}`} data-screen={screenFlag}>
        <QuickToast />
        <AppHeader />
        <DashboardPage screenFlag={screenFlag} />
        <FooterStatus />
      </div>
    </AppErrorBoundary>
  );
}
