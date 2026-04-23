import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Activity, Fingerprint, Hash, Shield, Users, Zap } from 'lucide-react';
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
  const headerTextClass = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground/45';
  const virtualEnabled = filtered.length > 200;
  const estimatedRowHeight = density === 'compact' ? 28 : 34;
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => estimatedRowHeight,
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
    <table className={`relative z-0 w-full table-fixed border-separate border-spacing-0 transition-[font-size,line-height] duration-200 ease-out ${density === 'compact' ? 'text-[12px] leading-4' : 'text-[13px] leading-[1.25rem]'}`}>
      <colgroup>
        <col className="w-[3%]" />
        <col className="w-[26%]" />
        <col className="w-[7%]" />
        <col className="w-[21%]" />
        <col className="w-[4%]" />
        <col className="w-[13%]" />
        <col className="w-[12%]" />
        <col className="w-[14%]" />
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
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 opacity-70" />
              Nhóm
            </span>
          </th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-right`}>
            <span className="inline-flex items-center justify-end gap-1">
              <Hash className="h-3 w-3 opacity-70" />
              TV
            </span>
          </th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>
            <span className="inline-flex items-center gap-1">
              <Fingerprint className="h-3 w-3 opacity-70" />
              Chat ID
            </span>
          </th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-center`} />
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3 w-3 opacity-70" />
              Quyền gửi
            </span>
          </th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-center`}>
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3 w-3 opacity-70" />
              Hành động
            </span>
          </th>
          <th className={`${stickyHeaderCellClass} ${headerTextClass} whitespace-nowrap text-left`}>
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3 opacity-70" />
              Trạng thái
            </span>
          </th>
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
