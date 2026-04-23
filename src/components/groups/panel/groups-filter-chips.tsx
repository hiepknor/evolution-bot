import { X } from 'lucide-react';

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

function FilterChip({
  category,
  value,
  onRemove,
  title,
  colorClass = 'border-border/50 bg-background/50 hover:bg-background/80'
}: {
  category: string;
  value: string;
  onRemove: () => void;
  title?: string;
  colorClass?: string;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors ${colorClass}`}
      onClick={onRemove}
      title={title}
    >
      <span className="text-muted-foreground">{category}:</span>
      <span className="font-medium text-foreground">{value}</span>
      <X className="h-3 w-3 shrink-0 text-muted-foreground" />
    </button>
  );
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
    <div className="flex flex-wrap items-center gap-1.5">
      {hasSearchFilter ? (
        <FilterChip
          category="Tìm"
          value={searchInputValue.trim()}
          onRemove={clearSearchInput}
          title="Bỏ bộ lọc từ khóa"
          colorClass="border-primary/25 bg-primary/[0.06] hover:bg-primary/10"
        />
      ) : null}
      {hasStatusFilter ? (
        <FilterChip
          category="Trạng thái"
          value={statusFilterLabel[statusFilterMode]}
          onRemove={() => setStatusFilterMode('all')}
          title="Bỏ lọc trạng thái"
        />
      ) : null}
      {hasPermissionFilter ? (
        <FilterChip
          category="Quyền gửi"
          value={permissionFilterLabel[permissionFilterMode]}
          onRemove={() => setPermissionFilterMode('all')}
          title="Bỏ lọc quyền gửi"
          colorClass="border-success/25 bg-success/[0.06] hover:bg-success/10"
        />
      ) : null}
      {hasMinMembersFilter ? (
        <FilterChip
          category="Tối thiểu"
          value={`${minMembers} thành viên`}
          onRemove={() => setMinMembersInput('')}
          title="Bỏ lọc tối thiểu thành viên"
          colorClass="border-warning/25 bg-warning/[0.06] hover:bg-warning/10"
        />
      ) : null}
      <button
        type="button"
        className="inline-flex h-6 items-center rounded-full px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        onClick={clearAllFilters}
      >
        Xóa tất cả
      </button>
    </div>
  );
}
