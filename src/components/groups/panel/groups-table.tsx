import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '@/components/ui/checkbox';
import type { Group, TargetStatus } from '@/lib/types/domain';
import { MemoizedGroupsTableRow } from '@/components/groups/panel/groups-table-row';
import {
  resolveEffectivePermissionState,
  selectedCheckboxClass,
  stickyHeaderCellClass
} from '@/components/groups/panel/shared';

interface GroupsTableProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  density?: 'comfortable' | 'compact';
  filtered: Group[];
  selectedIds: Set<string>;
  groupStatusByChatId: Map<string, TargetStatus>;
  listPolicyByChatId: Map<string, { listed: boolean; blocked: boolean; reason: string | null }>;
  copiedChatId: string | null;
  whitelistMode: boolean;
  allVisibleSelected: boolean;
  selectableVisibleIds: string[];
  onToggleSelect: (chatId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCopyChatId: (chatId: string) => Promise<void>;
  onToggleListMembership: (chatId: string) => void;
  setRowRef: (chatId: string, element: HTMLTableRowElement | null) => void;
}

export function GroupsTable({
  viewportRef,
  density = 'comfortable',
  filtered,
  selectedIds,
  groupStatusByChatId,
  listPolicyByChatId,
  copiedChatId,
  whitelistMode,
  allVisibleSelected,
  selectableVisibleIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onCopyChatId,
  onToggleListMembership,
  setRowRef
}: GroupsTableProps): JSX.Element {
  const headerTextClass = 'text-[11px]';
  const virtualEnabled = filtered.length > 200;
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 40,
    overscan: 10,
    enabled: virtualEnabled
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const topPadding = virtualEnabled && virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const bottomPadding =
    virtualEnabled && virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end
      : 0;
  const visibleRows = virtualEnabled
    ? virtualItems.map((item) => ({ group: filtered[item.index]!, key: item.key }))
    : filtered.map((group) => ({ group, key: group.chatId }));

  return (
    <table className="relative z-0 w-full table-fixed border-separate border-spacing-0 text-[13px] leading-[1.25rem] transition-[font-size,line-height] duration-200 ease-out">
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
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>
            <Checkbox
              className={selectedCheckboxClass}
              checked={allVisibleSelected}
              disabled={selectableVisibleIds.length === 0}
              onCheckedChange={(checked) => (checked ? onSelectAll() : onDeselectAll())}
            />
          </th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>Nhóm</th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-right`}>Thành viên</th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>Chat ID</th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-center`} />
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>Quyền gửi</th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-center`}>Hành động</th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {filtered.length > 0 ? (
          <>
            {topPadding > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={8} style={{ height: `${topPadding}px` }} />
              </tr>
            ) : null}
            {visibleRows.map(({ group, key }) => {
            const listPolicy = listPolicyByChatId.get(group.chatId) ?? {
              listed: false,
              blocked: false,
              reason: null
            };
            const canSend = resolveEffectivePermissionState(group, listPolicy.blocked) !== 'blocked';

            return (
              <MemoizedGroupsTableRow
                key={key}
                group={group}
                density={density}
                targetStatus={groupStatusByChatId.get(group.chatId)}
                listPolicy={listPolicy}
                selected={selectedIds.has(group.chatId)}
                copiedChatId={copiedChatId}
                canSend={canSend}
                whitelistMode={whitelistMode}
                onToggleSelect={onToggleSelect}
                onCopyChatId={onCopyChatId}
                onToggleListMembership={onToggleListMembership}
                rowRef={(element) => setRowRef(group.chatId, element)}
              />
            );
            })}
            {bottomPadding > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={8} style={{ height: `${bottomPadding}px` }} />
              </tr>
            ) : null}
          </>
        ) : (
          <tr className="border-t border-border/70">
            <td colSpan={8} className="p-3 text-center text-sm text-muted-foreground">
              Không có nhóm khớp bộ lọc hiện tại. Hãy nới từ khóa tìm kiếm hoặc số thành viên.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
