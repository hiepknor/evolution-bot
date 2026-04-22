import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GroupPermissionFilterMode, GroupStatusFilterMode } from '@/lib/groups/group-filtering';

interface GroupsFilterChipsProps {
  hasAnyFilter: boolean;
  hasSearchFilter: boolean;
  hasStatusFilter: boolean;
  hasPermissionFilter: boolean;
  hasMinMembersFilter: boolean;
  searchInputValue: string;
  statusFilterMode: GroupStatusFilterMode;
  permissionFilterMode: GroupPermissionFilterMode;
  statusFilterLabel: Record<GroupStatusFilterMode, string>;
  permissionFilterLabel: Record<GroupPermissionFilterMode, string>;
  minMembers: number | null;
  clearSearchInput: () => void;
  setStatusFilterMode: (mode: GroupStatusFilterMode) => void;
  setPermissionFilterMode: (mode: GroupPermissionFilterMode) => void;
  setMinMembersInput: (value: string) => void;
  clearAllFilters: () => void;
}

export function GroupsFilterChips({
  hasAnyFilter,
  hasSearchFilter,
  hasStatusFilter,
  hasPermissionFilter,
  hasMinMembersFilter,
  searchInputValue,
  statusFilterMode,
  permissionFilterMode,
  statusFilterLabel,
  permissionFilterLabel,
  minMembers,
  clearSearchInput,
  setStatusFilterMode,
  setPermissionFilterMode,
  setMinMembersInput,
  clearAllFilters
}: GroupsFilterChipsProps): JSX.Element | null {
  if (!hasAnyFilter) {
    return null;
  }

  return (
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
        className="rounded-full px-2.5 text-xs text-muted-foreground"
        onClick={clearAllFilters}
      >
        Xóa tất cả bộ lọc
      </Button>
    </div>
  );
}
