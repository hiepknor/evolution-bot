import dayjs from 'dayjs';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, RefreshCw, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { panelTokens } from '@/components/layout/panel-tokens';
import { createProvider } from '@/lib/providers/provider-factory';
import { AppError } from '@/lib/utils/error';
import { settingsRepo } from '@/lib/db/repositories';
import {
  applyGroupFilters,
  createGroupStatusMap,
  createSentStatusMap,
  parseMinMembersInput,
  resolveGroupPermissionState,
  type GroupFilterCounts,
  type GroupPermissionState,
  type GroupPermissionFilterMode,
  type GroupStatusFilterMode
} from '@/lib/groups/group-filtering';
import type { Group, TargetStatus } from '@/lib/types/domain';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useSettingsStore } from '@/stores/use-settings-store';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useActivityLogStore } from '@/stores/use-activity-log-store';

const formatChatId = (chatId: string): string => {
  if (chatId.length <= 24) {
    return chatId;
  }
  return `${chatId.slice(0, 12)}...${chatId.slice(-8)}`;
};

const formatUnnamedGroupLabel = (chatId: string): string => {
  const base = chatId.split('@')[0]?.trim() ?? '';
  if (!base) {
    return 'Nhóm chưa có tên';
  }
  const suffix = base.slice(-4);
  return `Nhóm chưa có tên (${suffix})`;
};

const normalizeChatId = (chatId: string): string => chatId.trim().toLowerCase();

const resolveEffectivePermissionState = (
  group: Group,
  blockedByList: boolean
): GroupPermissionState => (blockedByList ? 'blocked' : resolveGroupPermissionState(group));

const selectedCheckboxClass =
  'border-border/70 data-[state=checked]:border-emerald-400/90 data-[state=checked]:bg-emerald-500/90 data-[state=checked]:text-emerald-50';

const stickyHeaderCellClass =
  'sticky z-20 bg-card px-3 py-2.5 align-middle text-sm font-semibold text-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]';

const statusFilterLabel: Record<GroupStatusFilterMode, string> = {
  all: 'Tất cả',
  pending: 'Chưa gửi',
  sent: 'Đã gửi'
};

const permissionFilterLabel: Record<GroupPermissionFilterMode, string> = {
  all: 'Mọi quyền',
  allowed: 'Gửi được',
  unknown: 'Cần kiểm tra',
  blocked: 'Không gửi được'
};

const connectionRequiredMessage =
  'Chưa kết nối instance. Mở cài đặt kết nối (icon bánh răng) và bấm "Kết nối".';
const groupsIgnoreRequiredMessage =
  'Instance đang bật groups_ignore=true. Tắt cờ này trong Evolution API trước khi tải danh sách nhóm.';

const getGroupStatusMeta = (
  status: TargetStatus | undefined,
  permissionState: GroupPermissionState,
  blockedByList = false
): { label: string; variant: 'secondary' | 'success' | 'warning' | 'destructive' } => {
  if ((!status || status === 'pending') && blockedByList) {
    return { label: 'Bị chặn', variant: 'warning' };
  }

  if ((!status || status === 'pending') && permissionState === 'blocked') {
    return { label: 'Không gửi được', variant: 'destructive' };
  }

  if (!status || status === 'pending') {
    return { label: 'Chưa gửi', variant: 'secondary' };
  }

  if (status === 'running') {
    return { label: 'Đang gửi', variant: 'warning' };
  }

  if (status === 'sent') {
    return { label: 'Đã gửi', variant: 'success' };
  }

  if (status === 'dry-run-success') {
    return { label: 'Chạy thử OK', variant: 'success' };
  }

  if (status === 'failed') {
    return { label: 'Lỗi gửi', variant: 'destructive' };
  }

  if (status === 'skipped') {
    return { label: 'Bỏ qua', variant: 'warning' };
  }

  return { label: 'Đã dừng', variant: 'secondary' };
};

interface GroupsPanelProps {
  onOpenConnectionSettings?: () => void;
}

export function GroupsPanel({ onOpenConnectionSettings }: GroupsPanelProps): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.load);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const activeCampaign = useCampaignStore((state) => state.activeCampaign);
  const targets = useCampaignStore((state) => state.targets);
  const queueProgress = useCampaignStore((state) => state.queueProgress);
  const running = useCampaignStore((state) => state.running);
  const campaignConfig = useCampaignStore((state) => state.config);
  const setCampaignConfig = useCampaignStore((state) => state.setConfig);
  const pushUiLog = useActivityLogStore((state) => state.pushUiLog);
  const [statusFilterMode, setStatusFilterMode] = useState<GroupStatusFilterMode>('all');
  const [permissionFilterMode, setPermissionFilterMode] = useState<GroupPermissionFilterMode>('all');
  const [minMembersInput, setMinMembersInput] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState<string | null>(null);
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchInputComposing, setSearchInputComposing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const stickyFiltersRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const lastAutoScrolledChatIdRef = useRef<string | null>(null);
  const [tableHeaderTopOffset, setTableHeaderTopOffset] = useState(0);
  const [groupsIgnoreFlag, setGroupsIgnoreFlag] = useState<boolean | null>(null);

  const {
    groups,
    selectedIds,
    searchTerm,
    lastSyncedAt,
    setSearchTerm,
    toggleSelect,
    selectAllVisible,
    deselectAllVisible,
    invertSelectionVisible,
    replaceGroups,
    clearCache: clearGroupsCache
  } = useGroupsStore();

  const deferredSearchTerm = useDeferredValue(searchTerm);

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
        if (cancelled) {
          return;
        }
        setGroupsIgnoreFlag(syncSettings.groupsIgnore);
      },
      () => {
        if (cancelled) {
          return;
        }
        setGroupsIgnoreFlag(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    badgeState,
    settings
  ]);

  useEffect(() => {
    if (searchInputComposing) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (searchTerm !== searchInputValue) {
        setSearchTerm(searchInputValue);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchInputComposing, searchInputValue, searchTerm, setSearchTerm]);

  const clearSearchInput = () => {
    setSearchInputValue('');
    setSearchTerm('');
  };

  const minMembers = useMemo(() => parseMinMembersInput(minMembersInput), [minMembersInput]);
  const groupStatusByChatId = useMemo(() => createGroupStatusMap(targets), [targets]);
  const sentStatusByChatId = useMemo(() => createSentStatusMap(targets), [targets]);
  const normalizedConfigList = useMemo(
    () =>
      Array.from(
        new Set(
          campaignConfig.blacklist
            .map((item) => normalizeChatId(item))
            .filter(Boolean)
        )
      ),
    [campaignConfig.blacklist]
  );
  const configuredListSet = useMemo(
    () => new Set(normalizedConfigList),
    [normalizedConfigList]
  );
  const listPolicyByChatId = useMemo(() => {
    const policy = new Map<string, { listed: boolean; blocked: boolean; reason: string | null }>();
    for (const group of groups) {
      const listed = configuredListSet.has(normalizeChatId(group.chatId));
      const blocked = campaignConfig.whitelistMode ? !listed : listed;
      const reason = blocked
        ? campaignConfig.whitelistMode
          ? 'Ngoài danh sách cho phép'
          : 'Nằm trong danh sách chặn'
        : null;
      policy.set(group.chatId, { listed, blocked, reason });
    }
    return policy;
  }, [campaignConfig.whitelistMode, configuredListSet, groups]);
  const filteredForCounts = useMemo(
    () =>
      applyGroupFilters({
        groups,
        searchTerm: deferredSearchTerm,
        minMembers,
        statusFilterMode: 'all',
        permissionFilterMode: 'all',
        sentStatusByChatId
      }),
    [deferredSearchTerm, groups, minMembers, sentStatusByChatId]
  );
  const filteredBySearchAndStatus = useMemo(
    () =>
      applyGroupFilters({
        groups,
        searchTerm: deferredSearchTerm,
        minMembers,
        statusFilterMode,
        permissionFilterMode: 'all',
        sentStatusByChatId
      }),
    [deferredSearchTerm, groups, minMembers, sentStatusByChatId, statusFilterMode]
  );
  const filtered = useMemo(
    () =>
      filteredBySearchAndStatus.filter((group) => {
        const blockedByList = listPolicyByChatId.get(group.chatId)?.blocked === true;
        const permissionState = resolveEffectivePermissionState(group, blockedByList);
        if (permissionFilterMode === 'all') {
          return true;
        }
        return permissionState === permissionFilterMode;
      }),
    [filteredBySearchAndStatus, listPolicyByChatId, permissionFilterMode]
  );
  const filterCounts = useMemo<GroupFilterCounts>(() => {
    let sent = 0;
    let pending = 0;
    let allowed = 0;
    let blocked = 0;
    let unknown = 0;

    for (const group of filteredForCounts) {
      if (sentStatusByChatId.get(group.chatId) === true) {
        sent += 1;
      } else {
        pending += 1;
      }

      const blockedByList = listPolicyByChatId.get(group.chatId)?.blocked === true;
      const permissionState = resolveEffectivePermissionState(group, blockedByList);
      if (permissionState === 'allowed') {
        allowed += 1;
      } else if (permissionState === 'blocked') {
        blocked += 1;
      } else {
        unknown += 1;
      }
    }

    return {
      status: {
        all: filteredForCounts.length,
        sent,
        pending
      },
      permission: {
        all: filteredForCounts.length,
        allowed,
        blocked,
        unknown
      }
    };
  }, [filteredForCounts, listPolicyByChatId, sentStatusByChatId]);
  const selectableVisibleIds = useMemo(
    () =>
      filtered
        .filter((group) => {
          const blockedByList = listPolicyByChatId.get(group.chatId)?.blocked === true;
          return resolveEffectivePermissionState(group, blockedByList) !== 'blocked';
        })
        .map((group) => group.chatId),
    [filtered, listPolicyByChatId]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((chatId) => selectedIds.has(chatId));
  const selectedVisibleCount = selectableVisibleIds.filter((chatId) => selectedIds.has(chatId)).length;
  const blockedVisibleCount = filtered.length - selectableVisibleIds.length;
  const listBlockedVisibleCount = useMemo(
    () => filtered.filter((group) => listPolicyByChatId.get(group.chatId)?.blocked === true).length,
    [filtered, listPolicyByChatId]
  );
  const listModeLabel = campaignConfig.whitelistMode ? 'Danh sách cho phép' : 'Danh sách chặn';
  const listModeShortLabel = campaignConfig.whitelistMode ? 'DS cho phép' : 'DS chặn';
  const blockedSelectionLabel = `Khóa chọn: ${blockedVisibleCount}`;
  const blockedSelectionDetail =
    listBlockedVisibleCount > 0
      ? `${blockedVisibleCount} nhóm bị khóa chọn; ${listBlockedVisibleCount} do ${listModeShortLabel}.`
      : `${blockedVisibleCount} nhóm bị khóa chọn do quyền gửi.`;
  const hasSearchFilter = searchInputValue.trim().length > 0;
  const hasMinMembersFilter = minMembers !== null;
  const hasStatusFilter = statusFilterMode !== 'all';
  const hasPermissionFilter = permissionFilterMode !== 'all';
  const hasAnyFilter =
    hasSearchFilter || hasMinMembersFilter || hasStatusFilter || hasPermissionFilter;
  const hasGroups = groups.length > 0;
  const visibleSummary = `${filtered.length}/${groups.length}`;
  const activeCampaignDisplay = useMemo(() => {
    if (!activeCampaign) {
      return {
        label: 'chưa có',
        title: 'Trạng thái theo chiến dịch: chưa có'
      };
    }

    const campaignName = activeCampaign.name?.trim() ?? '';
    const campaignId = activeCampaign.id?.trim() ?? '';
    const preferredLabel = campaignName || campaignId;
    if (!preferredLabel) {
      return {
        label: 'chưa có',
        title: 'Trạng thái theo chiến dịch: chưa có'
      };
    }

    const compactLabel =
      !campaignName && preferredLabel.length > 26
        ? `${preferredLabel.slice(0, 12)}...${preferredLabel.slice(-8)}`
        : preferredLabel;
    return {
      label: compactLabel,
      title: `Trạng thái theo chiến dịch: ${preferredLabel}`
    };
  }, [activeCampaign]);
  const activeRunningChatId = useMemo(() => {
    if (!running) {
      return null;
    }

    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (target?.status === 'running') {
        return target.chatId;
      }
    }

    if (queueProgress?.currentTarget?.status === 'running') {
      return queueProgress.currentTarget.chatId;
    }

    return null;
  }, [
    queueProgress?.currentTarget?.chatId,
    queueProgress?.currentTarget?.status,
    running,
    targets
  ]);
  const copyChatId = async (chatId: string) => {
    try {
      await navigator.clipboard.writeText(chatId);
      setCopiedChatId(chatId);
      window.setTimeout(() => {
        setCopiedChatId((prev) => (prev === chatId ? null : prev));
      }, 1400);
    } catch {
      pushUiLog({
        level: 'warn',
        message: 'Không thể sao chép chat id. Vui lòng cấp quyền clipboard.'
      });
    }
  };
  const toggleListMembership = (chatId: string) => {
    const normalizedChatId = normalizeChatId(chatId);
    const nextList = new Set(normalizedConfigList);
    const listed = nextList.has(normalizedChatId);
    if (listed) {
      nextList.delete(normalizedChatId);
    } else {
      nextList.add(normalizedChatId);
    }
    const nextBlacklist = Array.from(nextList).sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' })
    );
    setCampaignConfig({ blacklist: nextBlacklist });

    const listLabel = campaignConfig.whitelistMode ? 'danh sách cho phép' : 'danh sách chặn';
    const actionLabel = listed ? 'gỡ khỏi' : 'thêm vào';
    pushUiLog({
      level: 'info',
      message: `Đã ${actionLabel} ${chatId} ${listLabel}.`
    });
  };

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
      const groupsFromApi = await provider.fetchGroups(currentSettings.instanceName, {
        previousGroups
      });
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
    onSuccess: ({
      count,
      keptPreviousGroups,
      previousCount,
      droppedSelectionCount,
      availableInstances,
      configuredInstance
    }) => {
      clearSearchInput();
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
      pushUiLog({
        level: 'success',
        message: `Đã tải ${count} nhóm từ Evo API`
      });
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
          message = `${error.message} Chưa cập nhật bảng để tránh hiển thị dữ liệu thiếu. Vui lòng thử lại sau 10-20 giây.`;
        } else if (error.code === 'INSTANCE_NOT_CONNECTED' || error.code === 'INSTANCE_CONNECTION_CHECK_FAILED') {
          message = error.message;
        } else if (error.code === 'FETCH_GROUPS_DISABLED_BY_SETTINGS') {
          message = `${error.message} Mở Evolution API > Settings của instance và đặt groups_ignore=false.`;
        } else {
          message = `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`;
        }
      } else if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      } else {
        message = `Đồng bộ danh sách nhóm thất bại: ${JSON.stringify(error)}`;
      }
      pushUiLog({
        level: 'error',
        message
      });
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
        message:
          clearedCount > 0
            ? `Đã xóa cache nhóm cục bộ (${clearedCount} nhóm).`
            : 'Cache nhóm đã trống.'
      });
    },
    onError: (error) => {
      const message = error instanceof AppError
        ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`
        : error instanceof Error
          ? error.message
          : 'Xóa cache nhóm thất bại';
      pushUiLog({
        level: 'error',
        message
      });
    }
  });

  const syncDisabledReason = useMemo(() => {
    if (syncMutation.isPending) {
      // Keep loading state clean and avoid mixed signals with connection warnings while syncing.
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
  }, [
    badgeState,
    clearCacheMutation.isPending,
    groupsIgnoreFlag,
    settings?.providerMode,
    syncMutation.isPending
  ]);

  const onSyncGroups = () => {
    syncMutation.mutate();
  };

  const onClearCache = () => {
    if (groups.length > 0 && !window.confirm('Xóa toàn bộ cache nhóm cục bộ?')) {
      return;
    }
    clearCacheMutation.mutate();
  };

  const isSyncLoading = syncMutation.isPending;
  const isConnectionBlocked = !isSyncLoading && syncDisabledReason === connectionRequiredMessage;
  const canTriggerConnectionCta = isConnectionBlocked && Boolean(onOpenConnectionSettings);
  const syncButtonDisabled =
    isSyncLoading ||
    clearCacheMutation.isPending ||
    (isConnectionBlocked && !canTriggerConnectionCta);
  const syncButtonTitle = isSyncLoading
    ? 'Đang đồng bộ danh sách nhóm từ Evo API'
    : isConnectionBlocked
      ? canTriggerConnectionCta
        ? 'Mở cài đặt kết nối'
        : connectionRequiredMessage
      : syncDisabledReason ?? 'Đồng bộ danh sách nhóm từ Evo API';
  const syncButtonLabel = isSyncLoading
    ? 'Đang đồng bộ...'
    : isConnectionBlocked
      ? 'Mở cài đặt kết nối'
      : 'Đồng bộ danh sách nhóm';
  const handleSyncPrimaryAction = () => {
    if (isConnectionBlocked) {
      onOpenConnectionSettings?.();
      return;
    }
    onSyncGroups();
  };
  const showGroupCountSyncHint = syncMutation.isPending;
  const groupCountLabel = showGroupCountSyncHint
    ? groups.length > 0
      ? `Đang đồng bộ • ${groups.length} nhóm`
      : 'Đang đồng bộ...'
    : !lastSyncedAt && groups.length === 0
      ? 'Chưa đồng bộ'
      : `${groups.length} nhóm`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingContext =
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable === true;
      if (isTypingContext) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!running || !activeRunningChatId) {
      return;
    }

    if (lastAutoScrolledChatIdRef.current === activeRunningChatId) {
      return;
    }

    const rowEl = rowRefs.current.get(activeRunningChatId);
    if (!rowEl || !tableViewportRef.current?.contains(rowEl)) {
      return;
    }

    lastAutoScrolledChatIdRef.current = activeRunningChatId;
    rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeRunningChatId, running]);

  useEffect(() => {
    if (!running) {
      lastAutoScrolledChatIdRef.current = null;
    }
  }, [running]);

  useEffect(() => {
    const stickyFiltersElement = stickyFiltersRef.current;
    if (!stickyFiltersElement) {
      setTableHeaderTopOffset(0);
      return;
    }

    const syncHeaderOffset = () => {
      setTableHeaderTopOffset(stickyFiltersElement.offsetHeight);
    };

    syncHeaderOffset();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => syncHeaderOffset());
      observer.observe(stickyFiltersElement);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', syncHeaderOffset);
    return () => window.removeEventListener('resize', syncHeaderOffset);
  }, []);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 bg-card/80 backdrop-blur-sm">
      <CardHeader className={`space-y-1 border-b border-border/70 ${panelTokens.cardHeader}`}>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Nhóm</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`h-6 items-center justify-center gap-1 rounded-full px-2 py-0 text-xs leading-none ${
                showGroupCountSyncHint ? 'border-primary/40 text-primary' : ''
              }`}
            >
              {showGroupCountSyncHint ? <RefreshCw className="h-3 w-3 animate-spin text-primary/90" /> : null}
              {groupCountLabel}
            </Badge>
            <Badge
              variant="secondary"
              className="h-6 items-center justify-center rounded-full px-2 py-0 text-xs leading-none"
            >
              {selectedIds.size} đã chọn
            </Badge>
          </div>
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          Đồng bộ lần cuối: {lastSyncedAt ? dayjs(lastSyncedAt).format('YYYY-MM-DD HH:mm:ss') : 'chưa có'}
        </div>
      </CardHeader>
      <CardContent className={`flex min-h-0 flex-1 flex-col overflow-hidden pt-3 ${panelTokens.cardContent}`}>
        <div className={panelTokens.section}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center justify-start gap-1.5">
              <Badge variant="outline" className="h-6 gap-1 rounded-full px-2">
                <Users className="h-3 w-3" />
                Hiển thị: {visibleSummary}
              </Badge>
              <Badge
                variant={campaignConfig.whitelistMode ? 'warning' : 'secondary'}
                className="h-6 max-w-[260px] items-center justify-start rounded-full px-2 text-xs"
                title={`Chính sách gửi: ${listModeLabel.toLowerCase()} (${campaignConfig.blacklist.length} chat id)`}
              >
                <span className="truncate">
                  Chính sách: {listModeShortLabel} ({campaignConfig.blacklist.length})
                </span>
              </Badge>
              {groupsIgnoreFlag === true ? (
                <Badge
                  variant="destructive"
                  className="h-6 max-w-[260px] items-center justify-start rounded-full px-2 text-xs"
                  title="groups_ignore=true: Evolution API đang bỏ qua group messages"
                >
                  <span className="truncate">groups_ignore: ON</span>
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className="h-6 max-w-[300px] items-center justify-start rounded-full px-2 text-xs"
                title={activeCampaignDisplay.title}
              >
                <span className="truncate">
                  Theo chiến dịch: {activeCampaignDisplay.label}
                </span>
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant={isConnectionBlocked ? 'outline' : 'default'}
                onClick={handleSyncPrimaryAction}
                className={`${panelTokens.control} w-auto min-w-[220px] rounded-md px-4 ${
                  isConnectionBlocked
                    ? 'border-warning/45 bg-warning/10 text-warning hover:bg-warning/15'
                    : 'bg-primary/95 text-primary-foreground shadow-[0_8px_24px_-14px_hsl(var(--primary))] hover:bg-primary'
                }`}
                disabled={syncButtonDisabled}
                title={syncButtonTitle}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncLoading ? 'animate-spin' : ''}`} />
                {syncButtonLabel}
              </Button>
              {hasGroups ? (
                <Button
                  variant="outline"
                  onClick={onClearCache}
                  disabled={syncMutation.isPending || clearCacheMutation.isPending}
                  className={`${panelTokens.control} rounded-md px-3`}
                >
                  {clearCacheMutation.isPending ? 'Đang xóa cache...' : 'Xóa cache'}
                </Button>
              ) : null}
            </div>
          </div>
          {syncDisabledReason ? (
            <div className="mt-2 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
              <span>{syncDisabledReason}</span>
            </div>
          ) : null}
        </div>

        <div ref={tableViewportRef} className="isolate min-h-0 flex-1 overflow-auto rounded-md border border-border">
          {hasGroups ? (
            <>
              <div
                ref={stickyFiltersRef}
                className="sticky top-0 z-30 space-y-3 border-b border-border/70 bg-card p-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[240px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        value={searchInputValue}
                        onChange={(event) => setSearchInputValue(event.target.value)}
                        onCompositionStart={() => setSearchInputComposing(true)}
                        onCompositionEnd={(event) => {
                          const nextValue = event.currentTarget.value;
                          setSearchInputComposing(false);
                          setSearchInputValue(nextValue);
                          setSearchTerm(nextValue);
                        }}
                        placeholder="Tìm theo tên nhóm hoặc chat id"
                        className={`${panelTokens.control} rounded-md border-border/70 bg-background/70 pl-9 pr-9 placeholder:text-foreground/55`}
                      />
                      {searchInputValue.trim().length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            clearSearchInput();
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Xóa từ khóa tìm kiếm"
                          aria-label="Xóa từ khóa tìm kiếm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="inline-flex items-center rounded-md border border-border/60 bg-background/40 p-0.5">
                      <Button
                        size="sm"
                        variant={statusFilterMode === 'all' ? 'default' : 'ghost'}
                        onClick={() => setStatusFilterMode('all')}
                        className={`${panelTokens.control} rounded-sm px-3`}
                      >
                        {statusFilterMode === 'all' ? `Tất cả (${filterCounts.status.all})` : 'Tất cả'}
                      </Button>
                      <Button
                        size="sm"
                        variant={statusFilterMode === 'pending' ? 'default' : 'ghost'}
                        onClick={() => setStatusFilterMode('pending')}
                        className={`${panelTokens.control} rounded-sm px-3`}
                      >
                        {statusFilterMode === 'pending'
                          ? `Chưa gửi (${filterCounts.status.pending})`
                          : 'Chưa gửi'}
                      </Button>
                      <Button
                        size="sm"
                        variant={statusFilterMode === 'sent' ? 'default' : 'ghost'}
                        onClick={() => setStatusFilterMode('sent')}
                        className={`${panelTokens.control} rounded-sm px-3`}
                      >
                        {statusFilterMode === 'sent' ? `Đã gửi (${filterCounts.status.sent})` : 'Đã gửi'}
                      </Button>
                    </div>
                    <Select
                      value={permissionFilterMode}
                      onValueChange={(value) => setPermissionFilterMode(value as GroupPermissionFilterMode)}
                    >
                      <SelectTrigger className={`${panelTokens.control} w-[176px] rounded-md border-border/70 bg-background/70`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Mọi quyền</SelectItem>
                        <SelectItem value="allowed">Gửi được</SelectItem>
                        <SelectItem value="unknown">Cần kiểm tra</SelectItem>
                        <SelectItem value="blocked">Không gửi được</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant={showAdvancedFilters || hasMinMembersFilter ? 'secondary' : 'outline'}
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className={`${panelTokens.control} gap-1.5 rounded-md px-3`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Bộ lọc nâng cao
                    </Button>
                  </div>
                  {showAdvancedFilters ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/10 p-2">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={minMembersInput}
                        onChange={(event) => setMinMembersInput(event.target.value)}
                        placeholder="Tối thiểu thành viên"
                        className={`${panelTokens.control} w-[180px] rounded-md border-border/70 bg-background/70`}
                      />
                      {hasMinMembersFilter ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`${panelTokens.control} px-3`}
                          onClick={() => setMinMembersInput('')}
                        >
                          Xóa mức tối thiểu
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {hasAnyFilter ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {hasSearchFilter ? (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground hover:bg-background"
                          onClick={clearSearchInput}
                          title="Bỏ bộ lọc từ khóa"
                        >
                          Từ khóa: {searchInputValue.trim()}
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ) : null}
                      {hasStatusFilter ? (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground hover:bg-background"
                          onClick={() => setStatusFilterMode('all')}
                          title="Bỏ lọc trạng thái"
                        >
                          Trạng thái: {statusFilterLabel[statusFilterMode]}
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ) : null}
                      {hasPermissionFilter ? (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground hover:bg-background"
                          onClick={() => setPermissionFilterMode('all')}
                          title="Bỏ lọc quyền gửi"
                        >
                          Quyền gửi: {permissionFilterLabel[permissionFilterMode]}
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ) : null}
                      {hasMinMembersFilter ? (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground hover:bg-background"
                          onClick={() => setMinMembersInput('')}
                          title="Bỏ lọc tối thiểu thành viên"
                        >
                          Từ {minMembers} thành viên
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-full px-2.5 text-xs text-muted-foreground"
                        onClick={() => {
                          clearSearchInput();
                          setStatusFilterMode('all');
                          setPermissionFilterMode('all');
                          setMinMembersInput('');
                        }}
                      >
                        Xóa tất cả bộ lọc
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/10 p-2">
                  <div className="text-sm text-foreground/85">
                    Chọn nhanh (trong bộ lọc hiện tại): {selectedVisibleCount} đã chọn
                  </div>
                  {blockedVisibleCount > 0 ? (
                    <Badge
                      variant="warning"
                      className="h-6 rounded-full px-2 text-xs"
                      title={blockedSelectionDetail}
                    >
                      {blockedSelectionLabel}
                    </Badge>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className={`${panelTokens.control} rounded-full px-3`}
                      onClick={() => selectAllVisible(selectableVisibleIds)}
                      disabled={selectableVisibleIds.length === 0}
                    >
                      Chọn tất cả
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className={`${panelTokens.control} rounded-full px-3`}
                      onClick={() => deselectAllVisible(selectableVisibleIds)}
                      disabled={selectableVisibleIds.length === 0}
                    >
                      Bỏ chọn
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className={`${panelTokens.control} rounded-full px-3`}
                      onClick={() => invertSelectionVisible(selectableVisibleIds)}
                      disabled={selectableVisibleIds.length === 0}
                    >
                      Đảo chọn
                    </Button>
                  </div>
                </div>
              </div>

              <table className="relative z-0 w-full table-fixed border-separate border-spacing-0 text-sm leading-5">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[27%]" />
                  <col className="w-[9%]" />
                  <col className="w-[21%]" />
                  <col className="w-[6%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-left`} style={{ top: tableHeaderTopOffset }}>
                      <Checkbox
                        className={selectedCheckboxClass}
                        checked={allVisibleSelected}
                        disabled={selectableVisibleIds.length === 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllVisible(selectableVisibleIds);
                            return;
                          }
                          deselectAllVisible(selectableVisibleIds);
                        }}
                      />
                    </th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-left`} style={{ top: tableHeaderTopOffset }}>Nhóm</th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-right`} style={{ top: tableHeaderTopOffset }}>Thành viên</th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-left`} style={{ top: tableHeaderTopOffset }}>Chat ID</th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-center`} style={{ top: tableHeaderTopOffset }}>
                      <Copy className="mx-auto h-4 w-4 text-muted-foreground" />
                    </th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-left`} style={{ top: tableHeaderTopOffset }}>Quyền gửi</th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-center`} style={{ top: tableHeaderTopOffset }}>Hành động</th>
                    <th className={`${stickyHeaderCellClass} whitespace-nowrap text-center`} style={{ top: tableHeaderTopOffset }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? (
                    filtered.map((group) => {
                      const targetStatus = groupStatusByChatId.get(group.chatId);
                      const listPolicy = listPolicyByChatId.get(group.chatId) ?? {
                        listed: false,
                        blocked: false,
                        reason: null
                      };
                      const permissionState = resolveEffectivePermissionState(group, listPolicy.blocked);
                      const statusMeta = getGroupStatusMeta(targetStatus, permissionState, listPolicy.blocked);
                      const isSelected = selectedIds.has(group.chatId);
                      const isRunningRow = targetStatus === 'running';
                      const isSelectionBlocked = permissionState === 'blocked';
                      const normalizedName = group.name.trim();
                      const normalizedChatId = normalizeChatId(group.chatId);
                      const hasDistinctName =
                        normalizedName.length > 0 && normalizeChatId(normalizedName) !== normalizedChatId;
                      const unnamedGroupLabel = formatUnnamedGroupLabel(group.chatId);
                      const displayName = hasDistinctName ? group.name : unnamedGroupLabel;
                      const permissionMeta =
                        permissionState === 'allowed'
                          ? { variant: 'success' as const, label: 'Gửi được' }
                          : permissionState === 'blocked'
                            ? {
                                variant: listPolicy.blocked ? 'warning' as const : 'destructive' as const,
                                label: listPolicy.blocked ? 'Bị chặn' : 'Không gửi được'
                              }
                            : { variant: 'warning' as const, label: 'Cần kiểm tra' };
                      const listActionLabel = campaignConfig.whitelistMode
                        ? listPolicy.listed
                          ? 'Gỡ DS cho phép'
                          : 'Thêm DS cho phép'
                        : listPolicy.listed
                          ? 'Bỏ chặn'
                          : 'Chặn';
                      const listActionTitle = campaignConfig.whitelistMode
                        ? listPolicy.listed
                          ? 'Gỡ chat id khỏi danh sách cho phép'
                          : 'Thêm chat id vào danh sách cho phép'
                        : listPolicy.listed
                          ? 'Gỡ chat id khỏi danh sách chặn'
                          : 'Thêm chat id vào danh sách chặn';
                      const isUnblockAction = !campaignConfig.whitelistMode && listPolicy.listed;
                      const listActionClass = isUnblockAction
                        ? 'h-7 rounded-full border-warning/45 bg-warning/10 px-2.5 text-xs text-warning hover:bg-warning/20'
                        : 'h-7 rounded-full border-border/65 bg-background/30 px-2.5 text-xs text-foreground/90 hover:bg-background/60';
                      return (
                        <tr
                          key={group.chatId}
                          ref={(element) => {
                            if (element) {
                              rowRefs.current.set(group.chatId, element);
                              return;
                            }
                            rowRefs.current.delete(group.chatId);
                          }}
                          className={`border-t border-border/70 ${
                            isRunningRow
                              ? 'bg-amber-500/12 ring-1 ring-inset ring-amber-400/40'
                              : isSelected
                                ? 'bg-emerald-500/12 ring-1 ring-inset ring-emerald-400/35'
                              : 'odd:bg-card even:bg-card/95'
                          } ${isSelectionBlocked ? 'opacity-70' : ''} hover:bg-muted/20`}
                        >
                          <td className="bg-inherit px-3 py-2.5 align-middle">
                            <Checkbox
                              className={selectedCheckboxClass}
                              checked={selectedIds.has(group.chatId)}
                              disabled={isSelectionBlocked}
                              onCheckedChange={() => toggleSelect(group.chatId)}
                            />
                          </td>
                          <td className="truncate px-3 py-2.5 align-middle text-sm" title={displayName}>
                            <span className={hasDistinctName ? 'text-foreground' : 'text-muted-foreground'}>
                              {displayName}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-right text-sm tabular-nums">{group.membersCount}</td>
                          <td className="px-3 py-2.5 align-middle">
                            <span className="block min-w-0 truncate font-mono text-sm" title={group.chatId}>
                              {formatChatId(group.chatId)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => void copyChatId(group.chatId)}
                              title="Sao chép chat id"
                            >
                              {copiedChatId === group.chatId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <Badge
                              variant={permissionMeta.variant}
                              className="whitespace-nowrap"
                              title={
                                listPolicy.blocked
                                  ? listPolicy.reason ?? 'Nhóm này bị chặn bởi cấu hình danh sách.'
                                  : isSelectionBlocked
                                    ? 'Nhóm này đang bị chặn theo quyền gửi.'
                                    : undefined
                              }
                            >
                              {permissionMeta.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={listActionClass}
                              onClick={() => toggleListMembership(group.chatId)}
                              title={listActionTitle}
                            >
                              {listActionLabel}
                            </Button>
                          </td>
                          <td className="px-3 py-2.5 align-middle text-center">
                            <Badge variant={statusMeta.variant} className="whitespace-nowrap">
                              {statusMeta.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-t border-border/70">
                      <td colSpan={8} className="p-3 text-center text-sm text-muted-foreground">
                        Không có nhóm khớp bộ lọc hiện tại. Hãy nới từ khóa tìm kiếm hoặc số thành viên.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-4">
              <div className="w-full max-w-xl rounded-md border border-dashed border-border/60 bg-muted/10 p-6 text-center">
                <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
                  {syncMutation.isPending ? (
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </div>
                <p className="text-base font-semibold text-foreground">
                  {syncMutation.isPending ? 'Đang đồng bộ danh sách nhóm' : 'Chưa có dữ liệu nhóm'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {syncMutation.isPending
                    ? 'Đang lấy danh sách nhóm và hoàn tất metadata bắt buộc. Bảng sẽ hiển thị khi dữ liệu sẵn sàng.'
                    : 'Dùng nút "Đồng bộ danh sách nhóm" ở phần điều khiển phía trên để lấy dữ liệu từ Evo API trước khi lọc và chọn nhóm gửi.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
