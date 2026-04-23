import dayjs from 'dayjs';
import { useCallback, useEffect, useRef } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { panelTokens } from '@/components/layout/panel-tokens';
import { useGroupsStore } from '@/stores/use-groups-store';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useGroupsFilter } from '@/components/groups/hooks/use-groups-filter';
import { useGroupsSelection } from '@/components/groups/hooks/use-groups-selection';
import { useGroupsSync } from '@/components/groups/hooks/use-groups-sync';
import { useGroupsPanelController } from '@/components/groups/hooks/use-groups-panel-controller';
import { GroupsSyncBar } from '@/components/groups/panel/groups-sync-bar';
import { GroupsFilterBar } from '@/components/groups/panel/groups-filter-bar';
import { GroupsSelectionToolbar } from '@/components/groups/panel/groups-selection-toolbar';
import { GroupsTable } from '@/components/groups/panel/groups-table';

interface GroupsPanelProps {
  onOpenConnectionSettings?: () => void;
}

export function GroupsPanel({ onOpenConnectionSettings }: GroupsPanelProps): JSX.Element {
  const didClearSearchAfterSyncRef = useRef(false);
  const activeCampaign = useCampaignStore((state) => state.activeCampaign);
  const targets = useCampaignStore((state) => state.targets);
  const queueProgress = useCampaignStore((state) => state.queueProgress);
  const running = useCampaignStore((state) => state.running);
  const campaignConfig = useCampaignStore((state) => state.config);
  const setCampaignConfig = useCampaignStore((state) => state.setConfig);

  const {
    groups,
    selectedIds,
    searchTerm,
    lastSyncedAt,
    setSearchTerm,
    toggleSelect,
    selectAllVisible,
    deselectAllVisible,
    invertSelectionVisible
  } = useGroupsStore();

  const filterState = useGroupsFilter({ groups, targets, campaignConfig, searchTerm, setSearchTerm });
  const selectionState = useGroupsSelection({
    filtered: filterState.filtered,
    selectedIds,
    whitelistMode: campaignConfig.whitelistMode,
    listPolicyByChatId: filterState.listPolicyByChatId,
    selectAllVisible,
    deselectAllVisible,
    invertSelectionVisible
  });

  const syncState = useGroupsSync({ groupsLength: groups.length, lastSyncedAt });
  const clearSearchInput = filterState.clearSearchInput;
  const controller = useGroupsPanelController({
    activeCampaign,
    targets,
    queueCurrentTarget: queueProgress?.currentTarget,
    running,
    whitelistMode: campaignConfig.whitelistMode,
    normalizedConfigList: filterState.normalizedConfigList,
    setCampaignConfig
  });

  useEffect(() => {
    if (syncState.syncMutation.isSuccess && !didClearSearchAfterSyncRef.current) {
      clearSearchInput();
      didClearSearchAfterSyncRef.current = true;
      return;
    }

    if (!syncState.syncMutation.isSuccess) {
      didClearSearchAfterSyncRef.current = false;
    }
  }, [clearSearchInput, syncState.syncMutation.isSuccess]);

  const onSyncPrimaryAction = () => {
    if (syncState.isConnectionBlocked) {
      onOpenConnectionSettings?.();
      return;
    }
    syncState.onSyncGroups();
  };

  const onClearCache = () => {
    if (groups.length > 0 && !window.confirm('Xóa toàn bộ cache nhóm cục bộ?')) {
      return;
    }
    syncState.onClearCache();
  };

  const hasGroups = groups.length > 0;
  const onToggle = useCallback((chatId: string) => toggleSelect(chatId), [toggleSelect]);
  const visibleSummary = `${filterState.filtered.length}/${groups.length}`;
  const listModeLabel = campaignConfig.whitelistMode ? 'Danh sách cho phép' : 'Danh sách chặn';
  const listModeShortLabel = campaignConfig.whitelistMode ? 'DS cho phép' : 'DS chặn';

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/80 bg-card/80 backdrop-blur-sm">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold leading-none text-foreground">Nhóm</CardTitle>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Đồng bộ lần cuối:{' '}
                {lastSyncedAt ? dayjs(lastSyncedAt).format('YYYY-MM-DD HH:mm:ss') : 'chưa có'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`h-6 gap-1.5 rounded-full px-2.5 text-xs ${syncState.isSyncLoading ? 'border-primary/40 text-primary' : ''}`}
            >
              {syncState.isSyncLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : null}
              {syncState.groupCountLabel}
            </Badge>
            {selectedIds.size > 0 ? (
              <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-xs tabular-nums">
                {selectedIds.size} đã chọn
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={`flex min-h-0 flex-1 flex-col overflow-hidden pt-3 ${panelTokens.cardContent}`}>
        <GroupsSyncBar
          visibleSummary={visibleSummary}
          listModeLabel={listModeLabel}
          listModeShortLabel={listModeShortLabel}
          blacklistLength={campaignConfig.blacklist.length}
          groupsIgnoreFlag={syncState.groupsIgnoreFlag}
          activeCampaignLabel={controller.activeCampaignDisplay.label}
          activeCampaignTitle={controller.activeCampaignDisplay.title}
          isConnectionBlocked={syncState.isConnectionBlocked}
          canTriggerConnectionCta={Boolean(onOpenConnectionSettings)}
          syncButtonDisabled={syncState.isSyncLoading || syncState.clearCacheMutation.isPending || (syncState.isConnectionBlocked && !onOpenConnectionSettings)}
          syncButtonTitle={syncState.syncButtonTitle}
          syncButtonLabel={syncState.syncButtonLabel}
          isSyncLoading={syncState.isSyncLoading}
          hasGroups={hasGroups}
          clearCachePending={syncState.clearCacheMutation.isPending}
          onSyncPrimaryAction={onSyncPrimaryAction}
          onClearCache={onClearCache}
          syncDisabledReason={syncState.syncDisabledReason}
        />

        <div className="isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
          {hasGroups ? (
            <>
              <div className="space-y-2 border-b border-border/55 bg-card/85 p-3">
                <GroupsFilterBar searchInputRef={controller.searchInputRef} setSearchTerm={setSearchTerm} {...filterState} />
                <GroupsSelectionToolbar
                  selectedVisibleCount={selectionState.selectedVisibleCount}
                  blockedVisibleCount={selectionState.blockedVisibleCount}
                  blockedSelectionLabel={selectionState.blockedSelectionLabel}
                  blockedSelectionDetail={selectionState.blockedSelectionDetail}
                  selectableVisibleCount={selectionState.selectableVisibleIds.length}
                  onSelectAllVisible={selectionState.onSelectAllVisible}
                  onDeselectAllVisible={selectionState.onDeselectAllVisible}
                  onInvertSelectionVisible={selectionState.onInvertSelectionVisible}
                />
              </div>
              <div ref={controller.tableViewportRef} className="min-h-0 flex-1 overflow-auto">
                <GroupsTable
                  viewportRef={controller.tableViewportRef}
                  filtered={filterState.filtered}
                  selectedIds={selectedIds}
                  groupStatusByChatId={filterState.groupStatusByChatId}
                  listPolicyByChatId={filterState.listPolicyByChatId}
                  copiedChatId={controller.copiedChatId}
                  whitelistMode={campaignConfig.whitelistMode}
                  allVisibleSelected={selectionState.allVisibleSelected}
                  selectableVisibleIds={selectionState.selectableVisibleIds}
                  onToggleSelect={onToggle}
                  onSelectAll={selectionState.onSelectAllVisible}
                  onDeselectAll={selectionState.onDeselectAllVisible}
                  onCopyChatId={controller.copyChatId}
                  onToggleListMembership={controller.toggleListMembership}
                  setRowRef={(chatId, element) => {
                    if (element) {
                      controller.rowRefs.current.set(chatId, element);
                      return;
                    }
                    controller.rowRefs.current.delete(chatId);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-4">
              <div className="w-full max-w-xl rounded-md border border-dashed border-border/60 bg-muted/10 p-6 text-center">
                <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
                  {syncState.isSyncLoading ? <RefreshCw className="h-5 w-5 animate-spin text-primary" /> : <Users className="h-5 w-5" />}
                </div>
                <p className="text-base font-semibold text-foreground">{syncState.isSyncLoading ? 'Đang đồng bộ danh sách nhóm' : 'Chưa có dữ liệu nhóm'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {syncState.isSyncLoading
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
