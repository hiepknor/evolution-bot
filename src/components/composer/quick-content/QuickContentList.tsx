import { GripVertical, Pencil, Search, X } from 'lucide-react';
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
    <section className={cn(panelTokens.section, 'flex h-full min-h-0 flex-col overflow-hidden bg-muted/[0.08] p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]')}>
      <div className="sticky top-0 z-10 space-y-2.5 border-b border-border/45 bg-[#182026]/95 px-3 py-3 shadow-[0_10px_20px_-18px_rgba(0,0,0,0.85)] backdrop-blur-sm">
        <div>
          <p className={panelTokens.sectionTitle}>Thư viện dòng mẫu</p>
          <p className={panelTokens.bodyText}>Tìm, chọn, sửa nhanh hoặc sắp xếp lại thứ tự ưu tiên.</p>
        </div>
        <div className={cn(panelTokens.toolbar, 'relative p-1')}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.searchTerm}
            onChange={(event) => props.setSearchTerm(event.target.value)}
            placeholder="Tìm dòng mẫu"
            className={`${panelTokens.control} rounded-md border-transparent bg-transparent pl-10 pr-10 placeholder:text-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0`}
          />
          {hasSearch ? (
            <button type="button" onClick={() => props.setSearchTerm('')} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Xóa từ khóa tìm kiếm" title="Xóa từ khóa tìm kiếm">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 h-full overflow-y-auto px-3 pb-3 pt-2">
        {props.loading ? <div className="rounded-lg border border-border/40 bg-background/45 px-4 py-8 text-center text-sm text-muted-foreground">Đang tải thư viện dòng mẫu...</div> : null}

        {!props.loading && props.items.length === 0 ? (
          <QuickContentEmptyState title="Chưa có dòng mẫu nào" description="Tạo dòng đầu tiên ở khối phía trên để dùng lại trong mẫu nội dung hiện tại và các lần sau." compact />
        ) : null}

        {!props.loading && props.items.length > 0 && props.filteredItems.length === 0 ? (
          <QuickContentEmptyState title="Không tìm thấy dòng mẫu phù hợp" description={hasSearch ? `Không có kết quả khớp với "${props.searchTerm.trim()}".` : 'Không có kết quả phù hợp bộ lọc hiện tại.'} />
        ) : null}

        {!props.loading ? (
          <div className="space-y-3">
            {props.filteredItems.map((item) => {
              const isEditing = props.editingId === item.id;
              const isDropTarget = props.dropTargetId === item.id && props.draggingId !== item.id;
              const isSelected = props.selectedIds.includes(item.id);

              return (
                <div key={item.id} className="max-w-full">
                  {isEditing ? (
                    <div className={cn(panelTokens.row, 'grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2 border-border/35 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]')}>
                      <div className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground"><GripVertical className="h-3.5 w-3.5" /></div>
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
                      <Button type="button" size="sm" variant="outline" onClick={props.onCancelEditing} className={`${panelTokens.control} px-3`}>Hủy</Button>
                      <Button type="button" size="sm" onClick={props.onSaveEditing} disabled={props.saving} className={`${panelTokens.control} px-3`}>{props.saving ? 'Đang lưu...' : 'Lưu'}</Button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(`group grid ${panelTokens.row} grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 transition-all`, isSelected ? 'border-sky-500/35 bg-sky-500/[0.07] text-foreground' : 'border-border/40 bg-background/60 text-foreground hover:border-border/60 hover:bg-background/72', isDropTarget ? 'border-primary/60 bg-primary/10' : '', props.draggingId === item.id ? 'opacity-70' : '')}
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
                      <div className="inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground" title="Kéo để đổi thứ tự"><GripVertical className="h-3.5 w-3.5" /></div>
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => props.toggleSelection(item.id, checked)} aria-label={`Chọn dòng mẫu ${item.label || item.content}`} onClick={(event) => event.stopPropagation()} />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground" title={item.content}>{item.content}</span></span>
                      <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground" onClick={(event) => { event.stopPropagation(); props.onStartEditing(item); }} aria-label={`Sửa dòng mẫu ${item.label || item.content}`} title="Sửa"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive" onClick={(event) => { event.stopPropagation(); props.onDeleteItem(item.id); }} aria-label={`Xóa dòng mẫu ${item.label || item.content}`} title="Xóa"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/45 bg-[#182026]/95 px-3 py-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className={cn(panelTokens.bodyText, 'inline-flex min-h-10 flex-wrap items-center gap-2 rounded-full border border-border/35 bg-background/55 px-3 py-1.5')}>
            <span>{props.filteredItems.length} dòng đang hiển thị</span>
            <span className="text-border">•</span>
            <span>{props.selectedIds.length} dòng đã chọn</span>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button type="button" size="sm" variant="outline" onClick={props.onSelectAllVisible} disabled={props.filteredItems.length === 0} className={`${panelTokens.control} min-w-[128px] rounded-md px-3`}>Chọn tất cả</Button>
            <Button type="button" size="sm" variant="outline" onClick={props.onClearSelection} disabled={props.selectedIds.length === 0} className={`${panelTokens.control} min-w-[128px] rounded-md px-3`}>Bỏ chọn</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
