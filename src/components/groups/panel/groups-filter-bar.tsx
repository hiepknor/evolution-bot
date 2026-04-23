import type { RefObject } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import type { GroupFilterCounts, GroupPermissionFilterMode, GroupStatusFilterMode } from '@/lib/groups/group-filtering';
import { GroupsFilterChips } from '@/components/groups/panel/groups-filter-chips';
interface GroupsFilterBarProps {
  searchInputRef: RefObject<HTMLInputElement>;
  searchInputValue: string;
  searchInputComposing: boolean;
  setSearchInputValue: (value: string) => void;
  setSearchInputComposing: (composing: boolean) => void;
  setSearchTerm: (value: string) => void;
  clearSearchInput: () => void;
  statusFilterMode: GroupStatusFilterMode;
  setStatusFilterMode: (mode: GroupStatusFilterMode) => void;
  permissionFilterMode: GroupPermissionFilterMode;
  setPermissionFilterMode: (mode: GroupPermissionFilterMode) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean | ((prev: boolean) => boolean)) => void;
  hasMinMembersFilter: boolean;
  minMembersInput: string;
  setMinMembersInput: (value: string) => void;
  minMembers: number | null;
  hasAnyFilter: boolean;
  hasSearchFilter: boolean;
  hasStatusFilter: boolean;
  hasPermissionFilter: boolean;
  statusFilterLabel: Record<GroupStatusFilterMode, string>;
  permissionFilterLabel: Record<GroupPermissionFilterMode, string>;
  clearAllFilters: () => void;
  filterCounts: GroupFilterCounts;
}
export function GroupsFilterBar(props: GroupsFilterBarProps): JSX.Element {
  const {
    searchInputRef,
    searchInputValue,
    setSearchInputValue,
    setSearchInputComposing,
    setSearchTerm,
    clearSearchInput,
    statusFilterMode,
    setStatusFilterMode,
    permissionFilterMode,
    setPermissionFilterMode,
    showAdvancedFilters,
    setShowAdvancedFilters,
    hasMinMembersFilter,
    minMembersInput,
    setMinMembersInput,
    minMembers,
    hasAnyFilter,
    hasSearchFilter,
    hasStatusFilter,
    hasPermissionFilter,
    statusFilterLabel,
    permissionFilterLabel,
    clearAllFilters,
    filterCounts
  } = props;
  return (
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
            className={`${panelTokens.control} border-border/60 bg-background/60 pl-9 pr-9 placeholder:text-foreground/55`}
          />
          {searchInputValue.trim().length > 0 ? (
            <button
              type="button"
              onClick={clearSearchInput}
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Xóa từ khóa tìm kiếm"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {/* Status filter — segmented control */}
        <div className={cn(panelTokens.toolbar, 'inline-flex shrink-0 p-1')}>
          {(
            [
              { mode: 'all', label: 'Tất cả', count: filterCounts.status.all },
              { mode: 'pending', label: 'Chưa gửi', count: filterCounts.status.pending },
              { mode: 'sent', label: 'Đã gửi', count: filterCounts.status.sent },
              { mode: 'dry-run-success', label: 'Chạy thử', count: filterCounts.status.dryRunSuccess }
            ] as { mode: GroupStatusFilterMode; label: string; count: number }[]
          ).map(({ mode, label, count }) => {
            const isActive = statusFilterMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setStatusFilterMode(mode)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
                {isActive ? (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] tabular-nums text-primary">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Permission select */}
        <select
          value={permissionFilterMode}
          onChange={(event) => setPermissionFilterMode(event.target.value as GroupPermissionFilterMode)}
          className={`${panelTokens.control} h-10 w-[156px] shrink-0 rounded-lg border border-border/50 bg-background/60 px-3 text-sm text-foreground`}
          aria-label="Lọc quyền gửi"
        >
          <option value="all">Mọi quyền</option>
          <option value="allowed">Gửi được</option>
          <option value="unknown">Cần kiểm tra</option>
          <option value="blocked">Không gửi được</option>
        </select>

        <Button
          size="sm"
          variant={showAdvancedFilters || hasMinMembersFilter ? 'secondary' : 'outline'}
          onClick={() => setShowAdvancedFilters((prev) => !prev)}
          className={`${panelTokens.control} shrink-0 gap-1.5 px-3`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Nâng cao
        </Button>
      </div>
      {showAdvancedFilters ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/30 bg-muted/[0.08] p-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Tối thiểu thành viên</p>
            <Input
              type="number"
              min={0}
              step={1}
              value={minMembersInput}
              onChange={(event) => setMinMembersInput(event.target.value)}
              placeholder="Nhập số"
              className={`${panelTokens.control} w-[180px] border-border/60 bg-background/60`}
            />
          </div>
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
      <GroupsFilterChips
        hasAnyFilter={hasAnyFilter}
        hasSearchFilter={hasSearchFilter}
        hasStatusFilter={hasStatusFilter}
        hasPermissionFilter={hasPermissionFilter}
        hasMinMembersFilter={hasMinMembersFilter}
        searchInputValue={searchInputValue}
        statusFilterMode={statusFilterMode}
        permissionFilterMode={permissionFilterMode}
        statusFilterLabel={statusFilterLabel}
        permissionFilterLabel={permissionFilterLabel}
        minMembers={minMembers}
        clearSearchInput={clearSearchInput}
        setStatusFilterMode={setStatusFilterMode}
        setPermissionFilterMode={setPermissionFilterMode}
        setMinMembersInput={setMinMembersInput}
        clearAllFilters={clearAllFilters}
      />
    </div>
  );
}
