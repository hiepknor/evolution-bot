import { useCallback, useMemo } from 'react';
import type { Group } from '@/lib/types/domain';
import { resolveEffectivePermissionState } from '@/components/groups/panel/shared';

interface UseGroupsSelectionParams {
  filtered: Group[];
  selectedIds: Set<string>;
  whitelistMode: boolean;
  listPolicyByChatId: Map<string, { listed: boolean; blocked: boolean; reason: string | null }>;
  selectAllVisible: (ids: string[]) => void;
  deselectAllVisible: (ids: string[]) => void;
  invertSelectionVisible: (ids: string[]) => void;
}

export function useGroupsSelection({
  filtered,
  selectedIds,
  whitelistMode,
  listPolicyByChatId,
  selectAllVisible,
  deselectAllVisible,
  invertSelectionVisible
}: UseGroupsSelectionParams) {
  const selectableVisibleIds = useMemo(
    () => filtered.map((group) => group.chatId),
    [filtered]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((chatId) => selectedIds.has(chatId));

  const selectedVisibleCount = selectableVisibleIds.filter((chatId) => selectedIds.has(chatId)).length;

  const blockedVisibleCount = useMemo(
    () =>
      filtered.filter((group) => {
        const blockedByList = listPolicyByChatId.get(group.chatId)?.blocked === true;
        return resolveEffectivePermissionState(group, blockedByList) === 'blocked';
      }).length,
    [filtered, listPolicyByChatId]
  );

  const listBlockedVisibleCount = useMemo(
    () => filtered.filter((group) => listPolicyByChatId.get(group.chatId)?.blocked === true).length,
    [filtered, listPolicyByChatId]
  );

  const listModeShortLabel = whitelistMode ? 'DS cho phép' : 'DS chặn';
  const blockedSelectionLabel = `Có thể bỏ qua: ${blockedVisibleCount}`;
  const blockedSelectionDetail =
    listBlockedVisibleCount > 0
      ? `${blockedVisibleCount} nhóm có thể bị bỏ qua khi chạy; ${listBlockedVisibleCount} do ${listModeShortLabel}.`
      : `${blockedVisibleCount} nhóm có thể bị bỏ qua do quyền gửi.`;

  const onSelectAllVisible = useCallback(
    () => selectAllVisible(selectableVisibleIds),
    [selectAllVisible, selectableVisibleIds]
  );
  const onDeselectAllVisible = useCallback(
    () => deselectAllVisible(selectableVisibleIds),
    [deselectAllVisible, selectableVisibleIds]
  );
  const onInvertSelectionVisible = useCallback(
    () => invertSelectionVisible(selectableVisibleIds),
    [invertSelectionVisible, selectableVisibleIds]
  );

  return {
    selectableVisibleIds,
    allVisibleSelected,
    selectedVisibleCount,
    blockedVisibleCount,
    blockedSelectionLabel,
    blockedSelectionDetail,
    onSelectAllVisible,
    onDeselectAllVisible,
    onInvertSelectionVisible
  };
}
