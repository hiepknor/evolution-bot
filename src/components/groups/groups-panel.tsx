import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, RefreshCw, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createProvider } from '@/lib/providers/provider-factory';
import { AppError } from '@/lib/utils/error';
import { settingsRepo } from '@/lib/db/repositories';
import {
  applyGroupFilters,
  createGroupStatusMap,
  countGroupsByMode,
  createSentStatusMap,
  parseMinMembersInput,
  resolveGroupPermissionState,
  type GroupPermissionState,
  type GroupPermissionFilterMode,
  type GroupStatusFilterMode
} from '@/lib/groups/group-filtering';
import type { TargetStatus } from '@/lib/types/domain';
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

const selectedCheckboxClass =
  'border-border/70 data-[state=checked]:border-emerald-400/90 data-[state=checked]:bg-emerald-500/90 data-[state=checked]:text-emerald-50';

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

const getGroupStatusMeta = (
  status: TargetStatus | undefined,
  permissionState: GroupPermissionState
): { label: string; variant: 'secondary' | 'success' | 'warning' | 'destructive' } => {
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

export function GroupsPanel(): JSX.Element {
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.load);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const activeCampaign = useCampaignStore((state) => state.activeCampaign);
  const targets = useCampaignStore((state) => state.targets);
  const queueProgress = useCampaignStore((state) => state.queueProgress);
  const running = useCampaignStore((state) => state.running);
  const pushUiLog = useActivityLogStore((state) => state.pushUiLog);
  const [statusFilterMode, setStatusFilterMode] = useState<GroupStatusFilterMode>('all');
  const [permissionFilterMode, setPermissionFilterMode] = useState<GroupPermissionFilterMode>('all');
  const [minMembersInput, setMinMembersInput] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const lastAutoScrolledChatIdRef = useRef<string | null>(null);

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

  const minMembers = useMemo(() => parseMinMembersInput(minMembersInput), [minMembersInput]);
  const groupStatusByChatId = useMemo(() => createGroupStatusMap(targets), [targets]);
  const sentStatusByChatId = useMemo(() => createSentStatusMap(targets), [targets]);
  const filteredForCounts = useMemo(
    () =>
      applyGroupFilters({
        groups,
        searchTerm,
        minMembers,
        statusFilterMode: 'all',
        permissionFilterMode: 'all',
        sentStatusByChatId
      }),
    [groups, minMembers, searchTerm, sentStatusByChatId]
  );
  const filtered = useMemo(
    () =>
      applyGroupFilters({
        groups,
        searchTerm,
        minMembers,
        statusFilterMode,
        permissionFilterMode,
        sentStatusByChatId
      }),
    [groups, minMembers, permissionFilterMode, searchTerm, sentStatusByChatId, statusFilterMode]
  );
  const selectableVisibleIds = useMemo(
    () =>
      filtered
        .filter((group) => resolveGroupPermissionState(group) !== 'blocked')
        .map((group) => group.chatId),
    [filtered]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((chatId) => selectedIds.has(chatId));
  const selectedVisibleCount = selectableVisibleIds.filter((chatId) => selectedIds.has(chatId)).length;
  const blockedVisibleCount = filtered.length - selectableVisibleIds.length;
  const filterCounts = useMemo(
    () => countGroupsByMode(filteredForCounts, sentStatusByChatId),
    [filteredForCounts, sentStatusByChatId]
  );
  const hasSearchFilter = searchTerm.trim().length > 0;
  const hasMinMembersFilter = minMembers !== null;
  const hasStatusFilter = statusFilterMode !== 'all';
  const hasPermissionFilter = permissionFilterMode !== 'all';
  const hasAnyFilter =
    hasSearchFilter || hasMinMembersFilter || hasStatusFilter || hasPermissionFilter;
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

  const syncMutation = useMutation({
    onMutate: () => {
      pushUiLog({
        level: 'info',
        message: 'Đang tải danh sách nhóm đầy đủ từ Evo API (có thể mất 2-5 phút với tài khoản nhiều nhóm).'
      });
    },
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

      if (currentSettings.providerMode !== 'mock' && badgeState !== 'connected') {
        throw new Error('Chưa kết nối instance. Vui lòng vào tab Kết nối để bấm "Kết nối" trước.');
      }

      const provider = createProvider({
        mode: currentSettings.providerMode,
        baseUrl: currentSettings.baseUrl,
        apiKey: currentSettings.apiKey
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
      setSearchTerm('');
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
      const message = error instanceof AppError
        ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ''}`
        : error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : `Tải danh sách nhóm thất bại: ${JSON.stringify(error)}`;
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
      return 'Đang đồng bộ danh sách nhóm.';
    }
    if (clearCacheMutation.isPending) {
      return 'Đang xóa cache nhóm. Vui lòng chờ hoàn tất.';
    }
    if (settings?.providerMode !== 'mock' && badgeState !== 'connected') {
      return 'Chưa kết nối instance. Hãy vào tab Kết nối và bấm "Kết nối".';
    }
    return null;
  }, [
    badgeState,
    clearCacheMutation.isPending,
    settings?.providerMode,
    syncMutation.isPending
  ]);

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

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 bg-card/80 backdrop-blur-sm">
      <CardHeader className="space-y-1 border-b border-border/70 pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Nhóm</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-6 items-center justify-center rounded-full px-2 py-0 text-xs leading-none"
            >
              {groups.length} nhóm
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
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
        <div className="rounded-lg border border-border/55 bg-muted/20 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center justify-start gap-1.5">
              <Badge variant="outline" className="h-6 gap-1 rounded-full px-2">
                <Users className="h-3 w-3" />
                Hiển thị: {filtered.length}
              </Badge>
              <Badge
                variant="outline"
                className="h-6 max-w-[260px] items-center justify-start rounded-full px-2 text-[11px]"
                title={
                  activeCampaign
                    ? `Trạng thái theo chiến dịch: ${activeCampaign.name || activeCampaign.id}`
                    : 'Trạng thái theo chiến dịch: chưa có'
                }
              >
                <span className="truncate">
                  Theo chiến dịch: {activeCampaign ? activeCampaign.name || activeCampaign.id : 'chưa có'}
                </span>
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                onClick={() => syncMutation.mutate()}
                className="h-8 w-auto min-w-[220px] rounded-md bg-primary/95 px-4 text-xs text-primary-foreground shadow-[0_6px_20px_-10px_hsl(var(--primary))] hover:bg-primary"
                disabled={syncDisabledReason !== null}
                title={syncDisabledReason ?? 'Tải danh sách nhóm từ Evo API'}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Đang tải danh sách...' : 'Tải danh sách nhóm'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (groups.length > 0 && !window.confirm('Xóa toàn bộ cache nhóm cục bộ?')) {
                    return;
                  }
                  clearCacheMutation.mutate();
                }}
                disabled={syncMutation.isPending || clearCacheMutation.isPending || groups.length === 0}
                className="h-8 rounded-md px-3 text-xs"
              >
                {clearCacheMutation.isPending ? 'Đang xóa cache...' : 'Xóa cache'}
              </Button>
            </div>
          </div>
        </div>

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
          <div className="sticky top-0 z-30 space-y-2 border-b border-border/55 bg-card/95 p-2 backdrop-blur-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm theo tên nhóm hoặc chat id"
                    className="h-8 rounded-md border-border/70 bg-background/70 pl-9 text-xs"
                  />
                </div>
                <div className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background/40 p-0.5">
                  <Button
                    size="sm"
                    variant={statusFilterMode === 'all' ? 'default' : 'ghost'}
                    onClick={() => setStatusFilterMode('all')}
                    className="h-7 rounded-sm px-3 text-xs"
                  >
                    {statusFilterMode === 'all' ? `Tất cả (${filterCounts.status.all})` : 'Tất cả'}
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilterMode === 'pending' ? 'default' : 'ghost'}
                    onClick={() => setStatusFilterMode('pending')}
                    className="h-7 rounded-sm px-3 text-xs"
                  >
                    {statusFilterMode === 'pending'
                      ? `Chưa gửi (${filterCounts.status.pending})`
                      : 'Chưa gửi'}
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilterMode === 'sent' ? 'default' : 'ghost'}
                    onClick={() => setStatusFilterMode('sent')}
                    className="h-7 rounded-sm px-3 text-xs"
                  >
                    {statusFilterMode === 'sent' ? `Đã gửi (${filterCounts.status.sent})` : 'Đã gửi'}
                  </Button>
                </div>
                <Select
                  value={permissionFilterMode}
                  onValueChange={(value) => setPermissionFilterMode(value as GroupPermissionFilterMode)}
                >
                  <SelectTrigger className="h-8 w-[176px] rounded-md border-border/70 bg-background/70 text-xs">
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
                  className="h-8 gap-1.5 rounded-md px-3 text-xs"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
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
                    className="h-8 w-[168px] rounded-md border-border/70 bg-background/70 text-xs"
                  />
                  {hasMinMembersFilter ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs"
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
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground/90 hover:bg-background"
                      onClick={() => setSearchTerm('')}
                      title="Bỏ bộ lọc từ khóa"
                    >
                      Từ khóa: {searchTerm.trim()}
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ) : null}
                  {hasStatusFilter ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground/90 hover:bg-background"
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
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground/90 hover:bg-background"
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
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2.5 text-xs text-foreground/90 hover:bg-background"
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
                      setSearchTerm('');
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
              <div className="text-xs text-muted-foreground">
                Chọn nhanh (trong bộ lọc hiện tại): {selectedVisibleCount} đã chọn
              </div>
              {blockedVisibleCount > 0 ? (
                <Badge variant="warning" className="h-6 rounded-full px-2 text-[11px]">
                  {blockedVisibleCount} nhóm bị khóa chọn
                </Badge>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => selectAllVisible(selectableVisibleIds)}
                  disabled={selectableVisibleIds.length === 0}
                >
                  Chọn tất cả
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => deselectAllVisible(selectableVisibleIds)}
                  disabled={selectableVisibleIds.length === 0}
                >
                  Bỏ chọn
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => invertSelectionVisible(selectableVisibleIds)}
                  disabled={selectableVisibleIds.length === 0}
                >
                  Đảo chọn
                </Button>
              </div>
            </div>
          </div>

          <table className="w-full table-fixed text-xs leading-5">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[34%]" />
              <col className="w-[9%]" />
              <col className="w-[24%]" />
              <col className="w-[16%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="bg-muted/95 p-2 text-left">
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
                <th className="bg-muted/95 p-2 text-left">Nhóm</th>
                <th className="bg-muted/95 p-2 text-right">Thành viên</th>
                <th className="bg-muted/95 p-2 text-left">Chat ID</th>
                <th className="bg-muted/95 p-2 text-left">Quyền gửi</th>
                <th className="bg-muted/95 p-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((group) => {
                  const targetStatus = groupStatusByChatId.get(group.chatId);
                  const permissionState = resolveGroupPermissionState(group);
                  const statusMeta = getGroupStatusMeta(targetStatus, permissionState);
                  const isSelected = selectedIds.has(group.chatId);
                  const isRunningRow = targetStatus === 'running';
                  const isSelectionBlocked = permissionState === 'blocked';
                  const permissionMeta =
                    permissionState === 'allowed'
                      ? { variant: 'success' as const, label: 'Gửi được' }
                      : permissionState === 'blocked'
                        ? { variant: 'destructive' as const, label: 'Không gửi được' }
                        : { variant: 'warning' as const, label: 'Chỉ admin (cần kiểm tra)' };
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
                      <td className="bg-inherit p-2">
                        <Checkbox
                          className={selectedCheckboxClass}
                          checked={selectedIds.has(group.chatId)}
                          disabled={isSelectionBlocked}
                          onCheckedChange={() => toggleSelect(group.chatId)}
                        />
                      </td>
                      <td className="truncate p-2" title={group.name}>
                        {group.name}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right tabular-nums">{group.membersCount}</td>
                      <td className="p-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={group.chatId}>
                            {formatChatId(group.chatId)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => void copyChatId(group.chatId)}
                            title="Sao chép chat id"
                          >
                            {copiedChatId === group.chatId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={permissionMeta.variant}
                          className="whitespace-nowrap"
                          title={isSelectionBlocked ? 'Nhóm này không hỗ trợ gửi từ API hiện tại.' : undefined}
                        >
                          {permissionMeta.label}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </td>
                    </tr>
                  );
                })
              ) : groups.length > 0 ? (
                <tr className="border-t border-border/70">
                  <td colSpan={6} className="p-3 text-center text-xs text-muted-foreground">
                    Không có nhóm khớp bộ lọc hiện tại. Hãy nới từ khóa tìm kiếm hoặc số thành viên.
                  </td>
                </tr>
              ) : (
                <tr className="border-t border-border/70">
                  <td colSpan={6} className="p-3 text-center text-xs text-muted-foreground">
                    Chưa có nhóm. Bấm "Tải danh sách nhóm" để lấy dữ liệu từ Evo API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
