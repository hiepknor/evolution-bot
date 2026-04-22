import { useMemo } from 'react';
import { resolveGroupPermissionState } from '@/lib/groups/group-filtering';
import { lintTemplate } from '@/lib/templates/render-template';
import { normalizeChatId } from '@/components/composer/operations/utils';
import type { Group, ConnectionSettings, ComposerState } from '@/lib/types/domain';

interface CampaignStoreView {
  running: boolean;
  stopping: boolean;
  paused: boolean;
  config: {
    randomDelayMinMs: number;
    randomDelayMaxMs: number;
    maxAttempts: number;
    blacklist: string[];
    whitelistMode: boolean;
    warningThreshold: number;
  };
}

export function useOperationsSummary({
  settings,
  badgeState,
  groups,
  selectedIdsSet,
  composer,
  campaignStore
}: {
  settings: ConnectionSettings | null | undefined;
  badgeState: string;
  groups: Group[];
  selectedIdsSet: Set<string>;
  composer: ComposerState;
  campaignStore: CampaignStoreView;
}) {
  const selectedIds = useMemo(() => Array.from(selectedIdsSet), [selectedIdsSet]);
  const selectedCount = selectedIds.length;
  const controlsDisabled = campaignStore.running || campaignStore.stopping;
  const campaignPaused = campaignStore.paused;
  const campaignStopping = campaignStore.stopping;

  const groupNameByChatId = useMemo(() => {
    const mapping = new Map<string, string>();
    groups.forEach((group) => {
      const normalizedId = normalizeChatId(group.chatId);
      const normalizedName = group.name.trim();
      if (!normalizedId || !normalizedName || mapping.has(normalizedId)) {
        return;
      }
      mapping.set(normalizedId, normalizedName);
    });
    return mapping;
  }, [groups]);

  const selectedGroups = useMemo(
    () => groups.filter((group) => selectedIdsSet.has(group.chatId)),
    [groups, selectedIdsSet]
  );

  const blockedIds = useMemo(
    () => new Set(campaignStore.config.blacklist.map((item) => normalizeChatId(item))),
    [campaignStore.config.blacklist]
  );

  const effectiveTargets = useMemo(
    () =>
      campaignStore.config.whitelistMode
        ? selectedGroups.filter((group) => blockedIds.has(normalizeChatId(group.chatId)))
        : selectedGroups.filter((group) => !blockedIds.has(normalizeChatId(group.chatId))),
    [blockedIds, campaignStore.config.whitelistMode, selectedGroups]
  );

  const effectiveTargetCount = effectiveTargets.length;
  const permissionBlockedTargets = useMemo(
    () => effectiveTargets.filter((group) => resolveGroupPermissionState(group) === 'blocked'),
    [effectiveTargets]
  );

  const permissionBlockedCount = permissionBlockedTargets.length;
  const permissionAllowedCount = Math.max(0, effectiveTargetCount - permissionBlockedCount);
  const permissionBlockedPreview = useMemo(
    () =>
      permissionBlockedTargets
        .slice(0, 3)
        .map((group) => group.name.trim() || group.chatId)
        .join(', '),
    [permissionBlockedTargets]
  );

  const hasTargets = effectiveTargetCount > 0;
  const templateIssues = useMemo(() => lintTemplate(composer.captionTemplate), [composer.captionTemplate]);
  const templateErrors = useMemo(
    () => templateIssues.filter((issue) => issue.level === 'error'),
    [templateIssues]
  );
  const templateWarnings = useMemo(
    () => templateIssues.filter((issue) => issue.level === 'warning'),
    [templateIssues]
  );
  const hasTemplateEmptyWarning = useMemo(
    () => templateWarnings.some((issue) => issue.message.includes('đang trống')),
    [templateWarnings]
  );
  const displayedTemplateWarnings = useMemo(
    () => templateWarnings.filter((issue) => !issue.message.includes('đang trống')),
    [templateWarnings]
  );

  const hasTemplateErrors = templateErrors.length > 0;
  const hasContent = Boolean(
    composer.imagePath ||
      composer.captionTemplate.trim() ||
      composer.introText.trim() ||
      composer.titleText.trim() ||
      composer.footerText.trim() ||
      composer.plainTextFallback.trim()
  );

  const hasConnectionConfig = Boolean(settings?.baseUrl && settings?.apiKey && settings?.instanceName);
  const isConnected = badgeState === 'connected' || settings?.providerMode === 'mock';
  const canSend = hasConnectionConfig && isConnected && hasTargets && hasContent && !hasTemplateErrors;

  const missingReadinessReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!hasConnectionConfig) {
      reasons.push('thiếu cấu hình');
      return reasons;
    }
    if (!isConnected) {
      reasons.push('chưa kết nối instance');
    }
    if (!hasTargets) {
      reasons.push('chưa có nhóm hợp lệ');
    }
    if (!hasContent) {
      reasons.push('chưa có nội dung');
    }
    if (hasTemplateErrors) {
      reasons.push('lỗi mẫu nội dung');
    }
    return reasons;
  }, [hasConnectionConfig, hasContent, hasTargets, hasTemplateErrors, isConnected]);

  const executionDisabledReason = useMemo(() => {
    if (campaignStore.stopping) {
      return 'Chiến dịch đang dừng. Vui lòng chờ hệ thống hoàn tất trạng thái trước khi thao tác mới.';
    }
    if (campaignStore.running) {
      return campaignStore.paused
        ? 'Chiến dịch đang tạm dừng. Hãy tiếp tục hoặc dừng chiến dịch hiện tại.'
        : 'Chiến dịch đang chạy. Hãy tạm dừng hoặc dừng chiến dịch hiện tại trước khi thao tác mới.';
    }
    if (!hasConnectionConfig) {
      return 'Thiếu cấu hình kết nối (Base URL / API Key / Instance Name).';
    }
    if (!isConnected) {
      return 'Chưa kết nối instance. Hãy mở cài đặt kết nối (icon bánh răng) và bấm "Kết nối".';
    }
    if (!hasTargets) {
      return 'Chưa có nhóm nhận hợp lệ.';
    }
    if (!hasContent) {
      return 'Chưa có nội dung gửi.';
    }
    if (hasTemplateErrors) {
      return `Mẫu nội dung có lỗi: ${templateErrors[0]?.message ?? 'Vui lòng kiểm tra lại template.'}`;
    }
    return null;
  }, [
    campaignStore.paused,
    campaignStore.running,
    campaignStore.stopping,
    hasConnectionConfig,
    hasContent,
    hasTemplateErrors,
    hasTargets,
    isConnected,
    templateErrors
  ]);

  const executionBlocked = executionDisabledReason !== null;
  const executionBadgeHint = useMemo(() => {
    if (campaignStore.running || campaignStore.stopping) {
      return null;
    }
    if (!hasConnectionConfig) {
      return 'thiếu cấu hình';
    }
    if (!isConnected) {
      return 'chưa kết nối';
    }
    if (!hasTargets) {
      return 'chưa có nhóm hợp lệ';
    }
    if (!hasContent) {
      return 'chưa có nội dung';
    }
    if (hasTemplateErrors) {
      return 'lỗi mẫu nội dung';
    }
    return null;
  }, [
    campaignStore.running,
    campaignStore.stopping,
    hasConnectionConfig,
    hasContent,
    hasTargets,
    hasTemplateErrors,
    isConnected
  ]);

  const warningThresholdEnabled = campaignStore.config.warningThreshold > 0;
  const warningThresholdHit =
    warningThresholdEnabled && effectiveTargetCount > campaignStore.config.warningThreshold;
  const warningIntensity = warningThresholdEnabled
    ? effectiveTargetCount / campaignStore.config.warningThreshold
    : 0;
  const highVolumeRisk = warningThresholdHit && warningIntensity >= 3;
  const listModeLabel = campaignStore.config.whitelistMode ? 'Danh sách cho phép' : 'Danh sách chặn';
  const chatIdCount = campaignStore.config.blacklist.length;

  const activeProfile = useMemo(() => {
    const cfg = campaignStore.config;
    if (cfg.randomDelayMinMs === 4000 && cfg.randomDelayMaxMs === 8000 && cfg.maxAttempts === 3) {
      return 'safe' as const;
    }
    if (cfg.randomDelayMinMs === 800 && cfg.randomDelayMaxMs === 1500 && cfg.maxAttempts === 1) {
      return 'fast' as const;
    }
    if (cfg.randomDelayMinMs === 2000 && cfg.randomDelayMaxMs === 6000 && cfg.maxAttempts === 2) {
      return 'balanced' as const;
    }
    return 'custom' as const;
  }, [campaignStore.config]);

  const readiness = [
    {
      label: 'Kết nối',
      state: isConnected ? 'đạt' : 'thiếu',
      variant: (isConnected ? 'success' : 'outline') as 'success' | 'outline'
    },
    {
      label: 'Nhóm nhận',
      state: hasTargets ? 'đạt' : 'thiếu',
      variant: (hasTargets ? 'success' : 'outline') as 'success' | 'outline'
    },
    {
      label: 'Nội dung',
      state: hasContent ? 'đạt' : 'thiếu',
      variant: (hasContent ? 'success' : 'outline') as 'success' | 'outline'
    },
    {
      label: 'Mẫu hợp lệ',
      state: hasTemplateErrors ? 'lỗi' : hasTemplateEmptyWarning ? 'trống' : 'đạt',
      variant: (hasTemplateErrors ? 'destructive' : hasTemplateEmptyWarning ? 'secondary' : 'success') as
        | 'destructive'
        | 'secondary'
        | 'success'
    }
  ];

  return {
    selectedIds,
    selectedCount,
    controlsDisabled,
    campaignPaused,
    campaignStopping,
    groupNameByChatId,
    effectiveTargetCount,
    permissionBlockedCount,
    permissionAllowedCount,
    permissionBlockedPreview,
    hasTargets,
    templateErrors,
    displayedTemplateWarnings,
    hasTemplateErrors,
    hasTemplateEmptyWarning,
    hasContent,
    hasConnectionConfig,
    isConnected,
    canSend,
    missingReadinessReasons,
    executionDisabledReason,
    executionBlocked,
    executionBadgeHint,
    warningThresholdHit,
    highVolumeRisk,
    listModeLabel,
    chatIdCount,
    activeProfile,
    readiness,
    groups,
    composer,
    selectedIdsSet,
    settings
  };
}
