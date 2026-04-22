import type { RefObject } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { panelTokens } from '@/components/layout/panel-tokens';
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
        <div className="inline-flex items-center rounded-lg border border-border/45 bg-background/25 p-1">
          <Button
            size="sm"
            variant={statusFilterMode === 'all' ? 'default' : 'ghost'}
            onClick={() => setStatusFilterMode('all')}
            className={`${panelTokens.control} px-3.5 ${statusFilterMode === 'all' ? '' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {statusFilterMode === 'all' ? `Tất cả (${filterCounts.status.all})` : 'Tất cả'}
          </Button>
          <Button
            size="sm"
            variant={statusFilterMode === 'pending' ? 'default' : 'ghost'}
            onClick={() => setStatusFilterMode('pending')}
            className={`${panelTokens.control} px-3.5 ${statusFilterMode === 'pending' ? '' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {statusFilterMode === 'pending' ? `Chưa gửi (${filterCounts.status.pending})` : 'Chưa gửi'}
          </Button>
          <Button
            size="sm"
            variant={statusFilterMode === 'sent' ? 'default' : 'ghost'}
            onClick={() => setStatusFilterMode('sent')}
            className={`${panelTokens.control} px-3.5 ${statusFilterMode === 'sent' ? '' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {statusFilterMode === 'sent' ? `Đã gửi (${filterCounts.status.sent})` : 'Đã gửi'}
          </Button>
          <Button
            size="sm"
            variant={statusFilterMode === 'dry-run-success' ? 'default' : 'ghost'}
            onClick={() => setStatusFilterMode('dry-run-success')}
            className={`${panelTokens.control} px-3.5 ${statusFilterMode === 'dry-run-success' ? '' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {statusFilterMode === 'dry-run-success'
              ? `Chạy thử (${filterCounts.status.dryRunSuccess})`
              : 'Chạy thử'}
          </Button>
        </div>
        <Select
          value={permissionFilterMode}
          onValueChange={(value) => setPermissionFilterMode(value as GroupPermissionFilterMode)}
        >
          <SelectTrigger className={`${panelTokens.control} w-[176px] border-border/60 bg-background/60`}>
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
          className={`${panelTokens.control} gap-1.5 px-3`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Bộ lọc nâng cao
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
