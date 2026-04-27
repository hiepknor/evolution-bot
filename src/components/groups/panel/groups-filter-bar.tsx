import type { RefObject } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';

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

  const hasAdvanced = showAdvancedFilters || hasMinMembersFilter;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
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
            className={`${panelTokens.control} border-border/50 bg-background/55 pl-9 pr-9 placeholder:text-foreground/40`}
          />
          {searchInputValue.trim().length > 0 ? (
            <button
              type="button"
              onClick={clearSearchInput}
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Xóa từ khóa"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Status segmented control */}
        <div className={cn(panelTokens.toolbar, 'inline-flex shrink-0 p-0.5')}>
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

        {/* Permission filter — styled select */}
        <div className="relative shrink-0">
          <select
            value={permissionFilterMode}
            onChange={(event) => setPermissionFilterMode(event.target.value as GroupPermissionFilterMode)}
            className={cn(
              panelTokens.control,
              'h-10 w-[152px] appearance-none rounded-lg border border-border/50 bg-background/55',
              'pl-3 pr-8 text-sm text-foreground',
              permissionFilterMode !== 'all' ? 'border-success/30 bg-success/[0.06] text-success' : ''
            )}
            aria-label="Lọc quyền gửi"
          >
            <option value="all">Mọi quyền</option>
            <option value="allowed">Gửi được</option>
            <option value="unknown">Cần kiểm tra</option>
            <option value="blocked">Không gửi được</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((prev) => !prev)}
          className={cn(
            panelTokens.control,
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
            hasAdvanced
              ? 'border-primary/30 bg-primary/[0.07] text-primary hover:bg-primary/10'
              : 'border-border/50 bg-background/55 text-muted-foreground hover:border-border/70 hover:text-foreground'
          )}
          title={showAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Hiện bộ lọc nâng cao'}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Nâng cao
          {hasMinMembersFilter ? (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          ) : null}
        </button>
      </div>

      {/* Advanced panel */}
      {showAdvancedFilters ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/30 bg-muted/[0.06] px-3 py-2.5">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tối thiểu thành viên</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                value={minMembersInput}
                onChange={(event) => setMinMembersInput(event.target.value)}
                placeholder="Nhập số"
                className={`${panelTokens.control} w-[140px] border-border/40 bg-background/60 tabular-nums`}
              />
              {hasMinMembersFilter ? (
                <button
                  type="button"
                  onClick={() => setMinMembersInput('')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                  title="Xóa bộ lọc"
                  aria-label="Xóa bộ lọc thành viên tối thiểu"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
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
