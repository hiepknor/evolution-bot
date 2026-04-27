import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createProvider } from '@/lib/providers/provider-factory';
import { AppError } from '@/lib/utils/error';
import { settingsRepo } from '@/lib/db/repositories';
import { useActivityLogStore } from '@/stores/use-activity-log-store';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useSettingsStore } from '@/stores/use-settings-store';

const connectionRequiredMessage =
  'Chưa kết nối instance. Mở cài đặt kết nối và bấm "Kết nối".';
const groupsIgnoreRequiredMessage =
  'Instance đang bật groups_ignore=true. Tắt cờ này trong Evolution API trước khi tải danh sách nhóm.';

interface UseGroupsSyncParams {
  groupsLength: number;
  lastSyncedAt?: string;
}

export function useGroupsSync({ groupsLength, lastSyncedAt }: UseGroupsSyncParams) {
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.load);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const pushUiLog = useActivityLogStore((state) => state.pushUiLog);
  const replaceGroups = useGroupsStore((state) => state.replaceGroups);
  const clearGroupsCache = useGroupsStore((state) => state.clearCache);
  const [groupsIgnoreFlag, setGroupsIgnoreFlag] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const currentSettings = settings;
    const canCheckGroupsIgnore =
      Boolean(currentSettings?.baseUrl) &&
      Boolean(currentSettings?.apiKey) &&
      Boolean(currentSettings?.instanceName) &&
      currentSettings?.providerMode === 'evolution' &&
      badgeState === 'connected';

    if (!canCheckGroupsIgnore) {
      setGroupsIgnoreFlag(null);
      return () => {
        cancelled = true;
      };
    }

    const provider = createProvider({
      mode: currentSettings.providerMode,
      baseUrl: currentSettings.baseUrl,
      apiKey: currentSettings.apiKey
    });

    void provider.fetchInstanceSyncSettings(currentSettings.instanceName).then(
      (syncSettings) => {
        if (!cancelled) {
          setGroupsIgnoreFlag(syncSettings.groupsIgnore);
        }
      },
      () => {
        if (!cancelled) {
          setGroupsIgnoreFlag(null);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [badgeState, settings]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      let currentSettings = settings;
      if (!currentSettings) {
        await loadSettings();
        currentSettings = useSettingsStore.getState().settings;
      }
      if (!currentSettings) {
        currentSettings = await settingsRepo.get();
      }

      if (!currentSettings) {
        throw new Error('Vui lòng lưu cấu hình kết nối trước khi tải nhóm');
      }

      if (!currentSettings.baseUrl || !currentSettings.apiKey || !currentSettings.instanceName) {
        throw new Error('Thiếu Base URL / API Key / Instance Name');
      }

      const provider = createProvider({
        mode: currentSettings.providerMode,
        baseUrl: currentSettings.baseUrl,
        apiKey: currentSettings.apiKey
      });

      if (currentSettings.providerMode !== 'mock') {
        let connectionStateMessage = '';
        try {
          const connectionState = await provider.getConnectionState(currentSettings.instanceName);
          connectionStateMessage = connectionState.state;
          if (!connectionState.isConnected) {
            throw new AppError(
              'INSTANCE_NOT_CONNECTED',
              `Instance "${currentSettings.instanceName}" chưa kết nối (state: ${connectionState.state}). Vui lòng mở cài đặt kết nối (icon bánh răng) và bấm "Kết nối".`
            );
          }
        } catch (error) {
          if (error instanceof AppError && error.code === 'INSTANCE_NOT_CONNECTED') {
            throw error;
          }
          if (error instanceof AppError && (error.code === 'HTTP_ERROR' || error.code === 'REQUEST_FAILED')) {
            throw new AppError(
              'INSTANCE_CONNECTION_CHECK_FAILED',
              `Không kiểm tra được trạng thái kết nối instance "${currentSettings.instanceName}"${connectionStateMessage ? ` (state: ${connectionStateMessage})` : ''}. Vui lòng kiểm tra Evolution API và thử lại.`,
              error.status,
              error.details
            );
          }
          throw error;
        }
      }

      pushUiLog({
        level: 'info',
        message: 'Đang tải danh sách nhóm đầy đủ từ Evo API (có thể mất 2-5 phút với tài khoản nhiều nhóm).'
      });

      const groupsStoreState = useGroupsStore.getState();
      const selectedBefore = Array.from(groupsStoreState.selectedIds);
      const previousGroups = groupsStoreState.groups;
      const groupsFromApi = await provider.fetchGroups(currentSettings.instanceName, { previousGroups });
      const keptPreviousGroups = groupsFromApi.length === 0 && previousGroups.length > 0;
      const groupsAfterSync = keptPreviousGroups ? previousGroups : groupsFromApi;
      const allowedAfterSync = new Set(groupsAfterSync.map((group) => group.chatId));
      const droppedSelectionCount = selectedBefore.filter((id) => !allowedAfterSync.has(id)).length;
      if (!keptPreviousGroups) {
        await replaceGroups(groupsFromApi);
      }

      let availableInstances: string[] = [];
      if (groupsFromApi.length === 0) {
        try {
          availableInstances = await provider.fetchInstances();
        } catch {
          availableInstances = [];
        }
      }

      return {
        count: groupsFromApi.length,
        keptPreviousGroups,
        previousCount: previousGroups.length,
        droppedSelectionCount,
        availableInstances,
        configuredInstance: currentSettings.instanceName
      };
    },
    onSuccess: ({ count, keptPreviousGroups, previousCount, droppedSelectionCount, availableInstances, configuredInstance }) => {
      if (!count) {
        const normalizedConfigured = configuredInstance.trim().toLowerCase();
        const normalizedAvailable = availableInstances.map((item) => item.trim().toLowerCase());
        const configuredInList = normalizedAvailable.includes(normalizedConfigured);
        if (availableInstances.length > 0 && !configuredInList) {
          pushUiLog({
            level: 'warn',
            message: `Instance đang cấu hình "${configuredInstance}" không khớp danh sách instance có sẵn: ${availableInstances.join(', ')}`
          });
        }
        pushUiLog({
          level: 'warn',
          message: keptPreviousGroups
            ? `Evo API trả về 0 nhóm, hệ thống giữ lại cache cũ (${previousCount} nhóm) để tránh mất dữ liệu.`
            : 'Kết nối Evo API thành công nhưng chưa có nhóm nào.'
        });
        return;
      }

      pushUiLog({ level: 'success', message: `Đã tải ${count} nhóm từ Evo API` });
      if (droppedSelectionCount > 0) {
        pushUiLog({
          level: 'warn',
          message: `${droppedSelectionCount} nhóm đã chọn trước đó không còn tồn tại sau đồng bộ và đã bị bỏ chọn.`
        });
      }
    },
    onError: (error) => {
      let message: string;
      if (error instanceof AppError) {
        if (error.code === 'FETCH_GROUPS_RATE_LIMITED') {
          message = `${error.message} Hệ thống giữ nguyên danh sách nhóm cache hiện tại để tránh mất dữ liệu.`;
        } else if (error.code === 'FETCH_GROUPS_INCOMPLETE') {
          const details =
            typeof error.details === 'object' && error.details !== null
              ? (error.details as Record<string, unknown>)
              : null;
          const unresolvedBreakdown =
            details && typeof details.unresolvedBreakdown === 'object' && details.unresolvedBreakdown !== null
              ? (details.unresolvedBreakdown as Record<string, unknown>)
              : null;
          const missingName =
            unresolvedBreakdown && typeof unresolvedBreakdown.missingName === 'number'
              ? unresolvedBreakdown.missingName
              : 0;
          const missingMembers =
            unresolvedBreakdown && typeof unresolvedBreakdown.missingMembers === 'number'
              ? unresolvedBreakdown.missingMembers
              : 0;
          const missingPermission =
            unresolvedBreakdown && typeof unresolvedBreakdown.missingPermission === 'number'
              ? unresolvedBreakdown.missingPermission
              : 0;
          const detailParts: string[] = [];
          if (missingName > 0) {
            detailParts.push(`thiếu tên: ${missingName}`);
          }
          if (missingMembers > 0) {
            detailParts.push(`thiếu số thành viên: ${missingMembers}`);
          }
          if (missingPermission > 0) {
            detailParts.push(`thiếu quyền gửi: ${missingPermission}`);
          }
          const diagnostics = Array.isArray(details?.diagnostics)
            ? details.diagnostics.filter((item): item is string => typeof item === 'string')
            : [];
          const hasDatabaseLock = diagnostics.some((item) =>
            item.toLowerCase().includes('database lock')
          );
          const detailSuffix = detailParts.length > 0 ? ` Chi tiết: ${detailParts.join(', ')}.` : '';
          const lockSuffix = hasDatabaseLock
            ? ' Evolution API đang bận xử lý nội bộ (database lock tạm thời), vui lòng chờ thêm rồi đồng bộ lại.'
            : '';
          message = `${error.message} Chưa cập nhật bảng để tránh hiển thị dữ liệu thiếu. Vui lòng thử lại sau 10-20 giây.${detailSuffix}${lockSuffix}`;
        } else if (error.code === 'INSTANCE_NOT_CONNECTED' || error.code === 'INSTANCE_CONNECTION_CHECK_FAILED') {
          message = error.message;
        } else if (error.code === 'FETCH_GROUPS_DISABLED_BY_SETTINGS') {
          message = `${error.message} Mở Evolution API > Settings của instance và đặt groups_ignore=false.`;
        } else {
          message = `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`;
        }
      } else {
        message = error instanceof Error ? error.message : 'Đồng bộ danh sách nhóm thất bại';
      }
      pushUiLog({ level: 'error', message });
    }
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const clearedCount = useGroupsStore.getState().groups.length;
      await clearGroupsCache();
      return { clearedCount };
    },
    onSuccess: ({ clearedCount }) => {
      pushUiLog({
        level: 'info',
        message: clearedCount > 0 ? `Đã xóa cache nhóm cục bộ (${clearedCount} nhóm).` : 'Cache nhóm đã trống.'
      });
    },
    onError: (error) => {
      const message =
        error instanceof AppError
          ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`
          : error instanceof Error
            ? error.message
            : 'Xóa cache nhóm thất bại';
      pushUiLog({ level: 'error', message });
    }
  });

  const syncDisabledReason = useMemo(() => {
    if (syncMutation.isPending) {
      return null;
    }
    if (clearCacheMutation.isPending) {
      return 'Đang xóa cache nhóm. Vui lòng chờ hoàn tất.';
    }
    if (groupsIgnoreFlag === true) {
      return groupsIgnoreRequiredMessage;
    }
    if (settings?.providerMode !== 'mock' && badgeState !== 'connected') {
      return connectionRequiredMessage;
    }
    return null;
  }, [badgeState, clearCacheMutation.isPending, groupsIgnoreFlag, settings?.providerMode, syncMutation.isPending]);

  const isSyncLoading = syncMutation.isPending;
  const isConnectionBlocked = !isSyncLoading && syncDisabledReason === connectionRequiredMessage;
  const syncButtonTitle = isSyncLoading
    ? 'Đang đồng bộ danh sách nhóm từ Evo API'
    : isConnectionBlocked
      ? connectionRequiredMessage
      : syncDisabledReason ?? 'Đồng bộ danh sách nhóm từ Evo API';
  const syncButtonLabel = isSyncLoading ? 'Đang đồng bộ...' : isConnectionBlocked ? 'Mở cài đặt kết nối' : 'Đồng bộ danh sách nhóm';
  const groupCountLabel = isSyncLoading
    ? groupsLength > 0
      ? `Đang đồng bộ • ${groupsLength} nhóm`
      : 'Đang đồng bộ...'
    : !lastSyncedAt && groupsLength === 0
      ? 'Chưa đồng bộ'
      : `${groupsLength} nhóm`;

  return {
    groupsIgnoreFlag,
    syncMutation,
    clearCacheMutation,
    syncDisabledReason,
    isSyncLoading,
    isConnectionBlocked,
    syncButtonTitle,
    syncButtonLabel,
    groupCountLabel,
    onSyncGroups: () => syncMutation.mutate(),
    onClearCache: () => clearCacheMutation.mutate()
  };
}
