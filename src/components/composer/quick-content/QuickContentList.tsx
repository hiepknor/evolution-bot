import { GripVertical, Library, Pencil, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import type { QuickContentItem } from '@/lib/types/domain';
import { QuickContentEmptyState } from '@/components/composer/quick-content/QuickContentEmptyState';

export function QuickContentList(props: {
  loading: boolean;
  saving: boolean;
  items: QuickContentItem[];
  filteredItems: QuickContentItem[];
  selectedIds: string[];
  visibleItemIds: string[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  editingId: string | null;
  editingContent: string;
  setEditingContent: (value: string) => void;
  setEditingLabel: (value: string) => void;
  editingInputRef: React.RefObject<HTMLInputElement>;
  draggingId: string | null;
  dropTargetId: string | null;
  toggleSelection: (itemId: string, checked: boolean | 'indeterminate') => void;
  handleItemPress: (itemId: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onStartEditing: (item: QuickContentItem) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onDeleteItem: (itemId: string) => void;
  onInlineEditKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onDragStart: (itemId: string) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, itemId: string) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, itemId: string) => void;
  onDragEnd: () => void;
}): JSX.Element {
  const hasSearch = props.searchTerm.trim().length > 0;

  return (
    <section
      className={cn(
        panelTokens.section,
        'flex h-full min-h-0 flex-col overflow-hidden p-0'
      )}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 space-y-2.5 border-b border-border/40 bg-card/95 px-3 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/40 text-accent-foreground">
            <Library className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className={panelTokens.sectionTitle}>Thư viện dòng mẫu</p>
            <p className={panelTokens.metaText}>Tìm, chọn, sửa nhanh hoặc sắp xếp lại thứ tự.</p>
          </div>
        </div>
        <div className={cn(panelTokens.toolbar, 'relative p-1')}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.searchTerm}
            onChange={(event) => props.setSearchTerm(event.target.value)}
            placeholder="Tìm dòng mẫu"
            className={`${panelTokens.control} rounded-md border-transparent bg-transparent pl-10 pr-10 placeholder:text-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0`}
          />
          {hasSearch ? (
            <button
              type="button"
              onClick={() => props.setSearchTerm('')}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Xóa từ khóa"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* List */}
      <div className="h-full min-h-0 overflow-y-auto px-3 pb-3 pt-2">
        {props.loading ? (
          <div className="rounded-lg border border-border/40 bg-background/45 px-4 py-8 text-center text-sm text-muted-foreground">
            Đang tải thư viện dòng mẫu...
          </div>
        ) : null}

        {!props.loading && props.items.length === 0 ? (
          <QuickContentEmptyState
            title="Chưa có dòng mẫu nào"
            description="Tạo dòng đầu tiên ở khối bên trái để dùng lại trong các chiến dịch broadcast."
            compact
          />
        ) : null}

        {!props.loading && props.items.length > 0 && props.filteredItems.length === 0 ? (
          <QuickContentEmptyState
            title="Không tìm thấy kết quả"
            description={
              hasSearch
                ? `Không có dòng mẫu khớp với "${props.searchTerm.trim()}".`
                : 'Không có kết quả phù hợp bộ lọc hiện tại.'
            }
          />
        ) : null}

        {!props.loading ? (
          <div className="space-y-1.5">
            {props.filteredItems.map((item) => {
              const isEditing = props.editingId === item.id;
              const isDropTarget = props.dropTargetId === item.id && props.draggingId !== item.id;
              const isSelected = props.selectedIds.includes(item.id);

              return (
                <div key={item.id}>
                  {isEditing ? (
                    <div
                      className={cn(
                        panelTokens.row,
                        'grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2 border-primary/30 bg-background/70'
                      )}
                    >
                      <div className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      <Checkbox checked={isSelected} disabled aria-label={`Chọn dòng mẫu ${item.content}`} />
                      <Input
                        ref={props.editingInputRef}
                        value={props.editingContent}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          props.setEditingContent(nextValue);
                          props.setEditingLabel(nextValue);
                        }}
                        onKeyDown={props.onInlineEditKeyDown}
                        placeholder="Sửa dòng mẫu"
                        className={`${panelTokens.control} min-w-0 px-3`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={props.onCancelEditing}
                        className={`${panelTokens.control} px-3`}
                      >
                        Hủy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={props.onSaveEditing}
                        disabled={props.saving}
                        className={`${panelTokens.control} px-3`}
                      >
                        {props.saving ? 'Đang lưu...' : 'Lưu'}
                      </Button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        `group grid ${panelTokens.row} grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 transition-all duration-150`,
                        isSelected
                          ? 'border-primary/35 bg-primary/[0.07] text-foreground'
                          : 'border-border/35 bg-background/55 text-foreground hover:border-border/55 hover:bg-background/70',
                        isDropTarget ? 'border-primary/60 bg-primary/10 scale-[1.01]' : '',
                        props.draggingId === item.id ? 'opacity-50 scale-[0.98]' : ''
                      )}
                      draggable={!props.saving}
                      onDragStart={() => props.onDragStart(item.id)}
                      onDragOver={(event) => props.onDragOver(event, item.id)}
                      onDrop={(event) => props.onDrop(event, item.id)}
                      onDragEnd={props.onDragEnd}
                      onClick={() => props.handleItemPress(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          props.handleItemPress(item.id);
                        }
                      }}
                    >
                      <div
                        className="inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground"
                        title="Kéo để đổi thứ tự"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => props.toggleSelection(item.id, checked)}
                        aria-label={`Chọn dòng mẫu ${item.label || item.content}`}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <span className="min-w-0">
                        <span
                          className="block truncate text-sm text-foreground/90"
                          title={item.content}
                        >
                          {item.content}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/0 transition-all group-hover:text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onStartEditing(item);
                        }}
                        aria-label={`Sửa dòng mẫu ${item.label || item.content}`}
                        title="Sửa"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/0 transition-all group-hover:text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onDeleteItem(item.id);
                        }}
                        aria-label={`Xóa dòng mẫu ${item.label || item.content}`}
                        title="Xóa"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="border-t border-border/40 bg-card/95 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{props.filteredItems.length}</span> hiển thị
            </span>
            <span className="text-border">·</span>
            <span className="tabular-nums">
              <span className="font-medium text-foreground">{props.selectedIds.length}</span> đã chọn
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={props.onSelectAllVisible}
              disabled={props.filteredItems.length === 0}
              className="h-8 rounded-md px-3 text-xs"
            >
              Chọn tất cả
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={props.onClearSelection}
              disabled={props.selectedIds.length === 0}
              className="h-8 rounded-md px-3 text-xs"
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
