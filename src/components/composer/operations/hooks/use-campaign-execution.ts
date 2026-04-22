import { buildCampaignName } from '@/components/composer/operations/utils';
import type { ComposerState, Group, ConnectionSettings } from '@/lib/types/domain';

interface CampaignStoreExecutionView {
  running: boolean;
  stopping: boolean;
  paused: boolean;
  queue?: unknown;
  previewDuplicateWarning: (input: {
    groups: Group[];
    selectedIds: string[];
    composer: ComposerState;
  }) => Promise<{ warning: string | null }>;
  startCampaign: (input: {
    settings: ConnectionSettings;
    groups: Group[];
    selectedIds: string[];
    composer: ComposerState;
    dryRun: boolean;
    name: string;
  }) => Promise<void>;
  pauseCampaign: () => Promise<void>;
  resumeCampaign: () => Promise<void>;
  stopCampaign: () => void;
}

export function useCampaignExecution({
  campaignStore,
  settings,
  groups,
  selectedIds,
  composer,
  canSend,
  hasConnectionConfig,
  isConnected,
  hasTargets,
  hasContent,
  hasTemplateErrors,
  templateErrors,
  controlsDisabled,
  campaignName,
  setCampaignName,
  setDryRun,
  setConfirmOpen,
  setConfirmDuplicateWarning,
  pushUiLog
}: {
  campaignStore: CampaignStoreExecutionView;
  settings: ConnectionSettings | null | undefined;
  groups: Group[];
  selectedIds: string[];
  composer: ComposerState;
  canSend: boolean;
  hasConnectionConfig: boolean;
  isConnected: boolean;
  hasTargets: boolean;
  hasContent: boolean;
  hasTemplateErrors: boolean;
  templateErrors: Array<{ message: string }>;
  controlsDisabled: boolean;
  campaignName: string;
  setCampaignName: (value: string) => void;
  setDryRun: (value: boolean) => void;
  setConfirmOpen: (value: boolean) => void;
  setConfirmDuplicateWarning: (value: string | null) => void;
  pushUiLog: (payload: { level: 'info' | 'warn' | 'error' | 'success'; message: string }) => void;
}) {
  const executeCampaign = async (nextDryRun: boolean) => {
    if (controlsDisabled) {
      return;
    }

    if (!canSend) {
      const missing: string[] = [];
      if (!hasConnectionConfig) {
        missing.push('cấu hình kết nối');
      } else if (!isConnected) {
        missing.push('kết nối instance');
      }
      if (!hasTargets) missing.push('nhóm nhận');
      if (!hasContent) missing.push('nội dung');
      if (hasTemplateErrors) missing.push('mẫu nội dung hợp lệ');
      pushUiLog({ level: 'warn', message: `Chưa thể gửi. Thiếu: ${missing.join(', ')}.` });
      if (hasTemplateErrors && templateErrors[0]) {
        pushUiLog({ level: 'warn', message: `Lỗi mẫu nội dung: ${templateErrors[0].message}` });
      }
      return;
    }

    if (!campaignName.trim()) {
      pushUiLog({ level: 'warn', message: 'Tên chiến dịch không được để trống.' });
      return;
    }

    let duplicateWarning: string | null = null;
    if (!nextDryRun) {
      try {
        const duplicatePreview = await campaignStore.previewDuplicateWarning({
          groups,
          selectedIds,
          composer
        });
        duplicateWarning = duplicatePreview.warning;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể kiểm tra trùng chiến dịch';
        pushUiLog({ level: 'warn', message });
      }
    } else {
      setConfirmDuplicateWarning(null);
    }

    setConfirmDuplicateWarning(duplicateWarning);
    setDryRun(nextDryRun);
    setConfirmOpen(true);
  };

  const confirmExecution = async (dryRun: boolean) => {
    if (!settings || !canSend) {
      return;
    }
    if (hasTemplateErrors && templateErrors[0]) {
      pushUiLog({ level: 'warn', message: `Lỗi mẫu nội dung: ${templateErrors[0].message}` });
      return;
    }

    const normalizedCampaignName = campaignName.trim();
    if (!normalizedCampaignName) {
      pushUiLog({ level: 'warn', message: 'Tên chiến dịch không được để trống.' });
      return;
    }

    if (normalizedCampaignName !== campaignName) {
      setCampaignName(normalizedCampaignName);
    }

    try {
      await campaignStore.startCampaign({
        settings,
        groups,
        selectedIds,
        composer,
        dryRun,
        name: normalizedCampaignName
      });

      setCampaignName(buildCampaignName());
      setConfirmOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Không thể chạy chiến dịch';
      pushUiLog({ level: 'error', message: `Gửi thất bại: ${message}` });
    }
  };

  const emergencyStop = () => {
    campaignStore.stopCampaign();
  };

  const togglePause = async () => {
    if (campaignStore.paused) {
      await campaignStore.resumeCampaign();
      return;
    }
    await campaignStore.pauseCampaign();
  };

  return {
    executeCampaign,
    confirmExecution,
    emergencyStop,
    togglePause
  };
}
