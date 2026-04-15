import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { GripVertical, Pencil, Plus, Search, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { panelTokens } from '@/components/layout/panel-tokens';
import { quickContentItemsRepo } from '@/lib/db/repositories';
import type { QuickContentItem } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

type ApplyMode = 'insert' | 'replace';

interface QuickContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (content: string, mode: ApplyMode) => void;
}

const trimFormValues = (label: string, content: string) => ({
  label: label.trim(),
  content: content.trim()
});

const splitRawQuickContentInput = (value: string): string[] => value
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const normalizeQuickContentValue = (value: string): string => value
  .trim()
  .replace(/\s*\/+\s*/g, ' / ')
  .replace(/\s+/g, ' ')
  .toLowerCase();

export function QuickContentModal({
  open,
  onOpenChange,
  onApply
}: QuickContentModalProps): JSX.Element {
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<QuickContentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createContent, setCreateContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [applyMode, setApplyMode] = useState<ApplyMode>('insert');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadItems = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const nextItems = await quickContentItemsRepo.list();
        if (!active) {
          return;
        }
        setItems(nextItems);
        setSelectedIds((current) => current.filter((id) => nextItems.some((item) => item.id === id)));
      } catch (loadError) {
        if (!active) {
          return;
        }
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải thư viện dòng mẫu.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadItems();

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    editingInputRef.current?.focus();
    editingInputRef.current?.select();
  }, [editingId]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => (
      item.label.toLowerCase().includes(normalizedSearch) ||
      item.content.toLowerCase().includes(normalizedSearch)
    ));
  }, [items, searchTerm]);
  const selectedContent = useMemo(
    () => selectedItems.map((item) => item.content.trim()).filter(Boolean).join('\n'),
    [selectedItems]
  );
  const hasSearch = searchTerm.trim().length > 0;
  const visibleItemIds = filteredItems.map((item) => item.id);

  const reorderItems = async (sourceId: string, targetId: string): Promise<void> => {
    if (sourceId === targetId) {
      return;
    }

    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const previousItems = items;
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(sourceIndex, 1);
    if (!movedItem) {
      return;
    }
    nextItems.splice(targetIndex, 0, movedItem);
    const normalizedItems = nextItems.map((item, index) => ({
      ...item,
      sortOrder: index
    }));

    setItems(normalizedItems);
    setSaving(true);
    setError(null);
    try {
      await quickContentItemsRepo.reorder(normalizedItems.map((item) => item.id));
    } catch (reorderError) {
      setItems(previousItems);
      setError(reorderError instanceof Error ? reorderError.message : 'Không thể lưu thứ tự item.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (itemId: string, checked: boolean | 'indeterminate'): void => {
    setSelectedIds((current) => {
      if (checked === true) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((id) => id !== itemId);
    });
  };

  const handleCreate = async (): Promise<void> => {
    const rawLines = splitRawQuickContentInput(createContent);
    if (rawLines.length === 0) {
      setError('Nội dung không được để trống.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const createdItems: QuickContentItem[] = [];
      const existingValues = new Set(items.map((item) => normalizeQuickContentValue(item.content)));
      const seenInBatch = new Set<string>();
      let duplicateCount = 0;

      for (const rawLine of rawLines) {
        const nextItem = trimFormValues(rawLine, rawLine);
        if (!nextItem.content) {
          continue;
        }

        const normalizedValue = normalizeQuickContentValue(nextItem.content);
        if (!normalizedValue || existingValues.has(normalizedValue) || seenInBatch.has(normalizedValue)) {
          duplicateCount += 1;
          continue;
        }

        const created = await quickContentItemsRepo.create(nextItem);
        createdItems.push(created);
        seenInBatch.add(normalizedValue);
        existingValues.add(normalizedValue);
      }

      if (createdItems.length === 0) {
        setError(
          duplicateCount > 0
            ? 'Tất cả các dòng đều đã tồn tại hoặc bị trùng lặp.'
            : 'Không có dòng hợp lệ để thêm vào thư viện dòng mẫu.'
        );
        return;
      }

      setItems((current) => [...current, ...createdItems]);
      setSelectedIds((current) => [...current, ...createdItems.map((item) => item.id)]);
      setCreateContent('');
      if (duplicateCount > 0) {
        setError(`Đã thêm ${createdItems.length} dòng mới. Bỏ qua ${duplicateCount} dòng trùng lặp.`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể thêm dòng mẫu mới.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter') {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    if (event.metaKey || event.ctrlKey || !event.altKey) {
      event.preventDefault();
      void handleCreate();
    }
  };

  const startEditing = (item: QuickContentItem): void => {
    setEditingId(item.id);
    setEditingLabel(item.label);
    setEditingContent(item.content);
    setError(null);
  };

  const cancelEditing = (): void => {
    setEditingId(null);
    setEditingLabel('');
    setEditingContent('');
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editingId) {
      return;
    }

    const nextItem = trimFormValues(editingLabel, editingContent);
    if (!nextItem.label || !nextItem.content) {
      setError('Tên dòng mẫu và nội dung không được để trống.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await quickContentItemsRepo.update(editingId, nextItem);
      setItems((current) =>
        current.map((item) => (
          item.id === editingId
            ? {
                ...item,
                label: nextItem.label,
                content: nextItem.content,
                updatedAt: new Date().toISOString()
              }
            : item
        ))
      );
      cancelEditing();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật dòng mẫu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await quickContentItemsRepo.remove(itemId);
      setItems((current) => current.filter((item) => item.id !== itemId));
      setSelectedIds((current) => current.filter((id) => id !== itemId));
      if (editingId === itemId) {
        cancelEditing();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xoá dòng mẫu.');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (): void => {
    if (!selectedContent) {
      setError('Hãy chọn ít nhất một dòng mẫu để chèn vào mẫu nội dung.');
      return;
    }

    onApply(selectedContent, applyMode);
    onOpenChange(false);
  };

  const handleDragStart = (itemId: string): void => {
    setDraggingId(itemId);
    setDropTargetId(itemId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, itemId: string): void => {
    event.preventDefault();
    if (draggingId && draggingId !== itemId) {
      setDropTargetId(itemId);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>, itemId: string): Promise<void> => {
    event.preventDefault();
    const sourceId = draggingId;
    setDropTargetId(null);
    setDraggingId(null);

    if (!sourceId || sourceId === itemId) {
      return;
    }

    await reorderItems(sourceId, itemId);
  };

  const handleDragEnd = (): void => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleItemPress = (itemId: string): void => {
    toggleSelection(itemId, !selectedIds.includes(itemId));
  };

  const handleInlineEditKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSaveEdit();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex h-[86vh] max-h-[86vh] max-w-6xl flex-col overflow-hidden border-border/50 bg-[#182026] p-0">
        <AlertDialogHeader className="border-b border-border/50 px-5 pb-3 pt-3.5">
          <div className="pr-12 space-y-2">
            <AlertDialogTitle className={panelTokens.modalTitle}>
              Chọn dòng mẫu để chèn vào nội dung
            </AlertDialogTitle>
            <AlertDialogDescription className={panelTokens.bodyText}>
              Tìm trong thư viện dòng mẫu, chọn nội dung cần dùng và chèn trực tiếp vào phần mẫu nội dung đang soạn.
            </AlertDialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/45 bg-background/55 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Đóng modal"
            title="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-2 pt-3.5">
          <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.42fr)] xl:items-start">
            <div className="space-y-2.5 xl:sticky xl:top-0">
              <section className={cn(panelTokens.section, 'bg-muted/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]')}>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border/30 bg-background/60 text-muted-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className={panelTokens.sectionTitle}>Thêm dòng mẫu mới</p>
                      <p className={cn(panelTokens.bodyText, 'leading-6')}>
                        Dán một hoặc nhiều dòng để dùng lại trong mẫu nội dung.
                      </p>
                      <p className={panelTokens.metaText}>{items.length} dòng mẫu đã lưu</p>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <Textarea
                    rows={3}
                    value={createContent}
                    onChange={(event) => setCreateContent(event.target.value)}
                    onKeyDown={handleCreateInputKeyDown}
                    placeholder="Nhập một hoặc nhiều dòng sẽ chèn vào mẫu nội dung..."
                    className={cn(panelTokens.control, 'min-h-[96px] rounded-lg border-border/40 bg-background/80 py-3 pr-16 leading-6 placeholder:text-foreground/45')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-3 right-3 h-10 w-10 rounded-lg border border-border/35 bg-background/70 text-muted-foreground shadow-sm hover:bg-muted/70 hover:text-foreground"
                    onClick={() => void handleCreate()}
                    disabled={saving}
                    aria-label="Thêm dòng mẫu"
                    title="Thêm dòng mẫu"
                  >
                    {saving ? (
                      <span className="text-sm leading-none">...</span>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Thêm</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className={cn(panelTokens.bodyText, 'leading-6')}>
                  Dán nhiều dòng cùng lúc, hệ thống sẽ tự tách từng dòng mẫu và bỏ qua nội dung trùng lặp.
                </p>
              </section>

              <section className="rounded-lg border border-border/25 bg-background/20 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-medium text-foreground">Thêm nhanh vào thư viện</p>
                  <span className={panelTokens.metaText}>Dùng khi chưa có dòng phù hợp ở cột bên phải.</span>
                </div>
              </section>

              {error ? (
                <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </div>

            <section className={cn(panelTokens.section, 'flex h-full min-h-0 flex-col overflow-hidden bg-muted/[0.08] p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]')}>
              <div className="sticky top-0 z-10 space-y-2.5 border-b border-border/45 bg-[#182026]/95 px-3 py-3 shadow-[0_10px_20px_-18px_rgba(0,0,0,0.85)] backdrop-blur-sm">
                <div className="space-y-0.5">
                  <div>
                    <p className={panelTokens.sectionTitle}>Thư viện dòng mẫu</p>
                    <p className={panelTokens.bodyText}>Tìm, chọn, sửa nhanh hoặc sắp xếp lại thứ tự ưu tiên.</p>
                  </div>
                </div>
                <div className={cn(panelTokens.toolbar, 'relative p-1')}>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm dòng mẫu"
                    className={`${panelTokens.control} rounded-md border-transparent bg-transparent pl-10 pr-10 placeholder:text-foreground/45 focus-visible:ring-0 focus-visible:ring-offset-0`}
                  />
                  {hasSearch ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Xóa từ khóa tìm kiếm"
                      title="Xóa từ khóa tìm kiếm"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className={cn(panelTokens.bodyText, 'inline-flex min-h-10 flex-wrap items-center gap-2 rounded-full border border-border/35 bg-background/55 px-3 py-1.5')}>
                    <span>{filteredItems.length} dòng đang hiển thị</span>
                    <span className="text-border">•</span>
                    <span>{selectedIds.length} dòng đã chọn</span>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...visibleItemIds])))}
                      disabled={filteredItems.length === 0}
                      className={`${panelTokens.control} min-w-[128px] rounded-md px-3`}
                    >
                      Chọn tất cả
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedIds([])}
                      disabled={selectedIds.length === 0}
                      className={`${panelTokens.control} min-w-[128px] rounded-md px-3`}
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                <div className="pointer-events-none absolute left-3 right-3 top-0 z-[1] h-3 rounded-t-lg bg-gradient-to-b from-[#182026] to-transparent" />
                <div className="pointer-events-none absolute bottom-0 left-3 right-3 z-[1] h-4 rounded-b-lg bg-gradient-to-t from-[#182026] to-transparent" />
                <div className="min-h-0 h-full overflow-y-auto px-3 pb-3 pt-2 [scrollbar-color:rgba(148,163,184,0.38)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[2px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-slate-400/30 [&::-webkit-scrollbar-thumb:hover]:bg-slate-300/45">
                  {loading ? (
                    <div className="rounded-lg border border-border/40 bg-background/45 px-4 py-8 text-center text-sm text-muted-foreground">
                      Đang tải thư viện dòng mẫu...
                    </div>
                  ) : null}

                  {!loading && items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/40 bg-background/35 px-4 py-8 text-center">
                      <p className={panelTokens.sectionTitle}>Chưa có dòng mẫu nào</p>
                      <p className={cn(panelTokens.bodyText, 'mt-1')}>
                        Tạo dòng đầu tiên ở khối phía trên để dùng lại trong mẫu nội dung hiện tại và các lần sau.
                      </p>
                    </div>
                  ) : null}

                  {!loading && items.length > 0 && filteredItems.length === 0 ? (
                    <div className="flex min-h-[280px] h-full items-center justify-center rounded-lg border border-dashed border-border/40 bg-background/35 px-6 py-8 text-center">
                      <div className="flex max-w-md flex-col items-center justify-center space-y-3">
                        {hasSearch ? (
                          <div className="inline-flex items-center rounded-full border border-border/35 bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                            Bộ lọc hiện tại: "{searchTerm.trim()}"
                          </div>
                        ) : null}
                        <p className={panelTokens.sectionTitle}>Không tìm thấy dòng mẫu phù hợp</p>
                        <p className={panelTokens.bodyText}>
                          {hasSearch
                            ? `Không có kết quả khớp với "${searchTerm.trim()}". Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ thư viện.`
                            : 'Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ thư viện.'}
                        </p>
                        <p className={panelTokens.metaText}>
                          Bạn cũng có thể thêm nhanh một dòng mới ở cột bên trái.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {!loading ? (
                    <div className="space-y-3">
                      {filteredItems.map((item) => {
                      const isEditing = editingId === item.id;
                      const isDropTarget = dropTargetId === item.id && draggingId !== item.id;
                      const isSelected = selectedIds.includes(item.id);

                      return (
                        <div key={item.id} className="max-w-full">
                          {isEditing ? (
                            <div className={cn(panelTokens.row, 'grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2 border-border/35 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]')}>
                              <div className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground">
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                              <Checkbox checked={selectedIds.includes(item.id)} disabled aria-label={`Chọn dòng mẫu ${item.content}`} />
                              <Input
                                ref={editingInputRef}
                                value={editingContent}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setEditingContent(nextValue);
                                  setEditingLabel(nextValue);
                                }}
                                onKeyDown={handleInlineEditKeyDown}
                                placeholder="Sửa dòng mẫu"
                                className={`${panelTokens.control} min-w-0 px-3`}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                className={`${panelTokens.control} px-3`}
                              >
                                Hủy
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleSaveEdit()}
                                disabled={saving}
                                className={`${panelTokens.control} px-3`}
                              >
                                {saving ? 'Đang lưu...' : 'Lưu'}
                              </Button>
                            </div>
                          ) : (
                            <div
                              role="button"
                              tabIndex={0}
                              className={cn(
                                `group grid ${panelTokens.row} grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 transition-all`,
                                isSelected
                                  ? 'border-sky-500/35 bg-sky-500/[0.07] text-foreground shadow-[0_8px_24px_-20px_rgba(56,189,248,0.55)]'
                                  : 'border-border/40 bg-background/60 text-foreground hover:border-border/60 hover:bg-background/72',
                                isDropTarget ? 'border-primary/60 bg-primary/10' : '',
                                draggingId === item.id ? 'opacity-70' : ''
                              )}
                              draggable={!saving}
                              onDragStart={() => handleDragStart(item.id)}
                              onDragOver={(event) => handleDragOver(event, item.id)}
                              onDrop={(event) => {
                                void handleDrop(event, item.id);
                              }}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleItemPress(item.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleItemPress(item.id);
                                }
                              }}
                            >
                              <div
                                className="inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                                aria-label={`Kéo để đổi vị trí dòng mẫu ${item.label || item.content}`}
                                title="Kéo để đổi thứ tự"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleSelection(item.id, checked)}
                                aria-label={`Chọn dòng mẫu ${item.label || item.content}`}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <span className="min-w-0">
                                <span
                                  className="block truncate text-sm font-medium text-foreground"
                                  title={item.content}
                                >
                                  {item.content}
                                </span>
                              </span>
                              <button
                                type="button"
                                className={cn(
                                  'inline-flex h-6 w-6 items-center justify-center rounded-full transition-all hover:bg-muted hover:text-foreground',
                                  isSelected ? 'text-muted-foreground opacity-100' : 'text-muted-foreground/80 opacity-60 group-hover:opacity-100'
                                )}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEditing(item);
                                }}
                                aria-label={`Sửa dòng mẫu ${item.label || item.content}`}
                                title="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  'inline-flex h-6 w-6 items-center justify-center rounded-full transition-all hover:bg-destructive/10 hover:text-destructive',
                                  isSelected ? 'text-muted-foreground opacity-100' : 'text-muted-foreground/80 opacity-60 group-hover:opacity-100'
                                )}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDelete(item.id);
                                }}
                                aria-label={`Xóa dòng mẫu ${item.label || item.content}`}
                                title="Xóa"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </div>

        <AlertDialogFooter className="flex flex-col items-stretch justify-between gap-3 border-t border-border/45 bg-background/35 px-5 py-3 shadow-[0_-8px_18px_-18px_rgba(0,0,0,0.75)] sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <div className={cn(panelTokens.toolbar, 'inline-flex w-full flex-wrap p-1 sm:w-auto')}>
              <Button
                type="button"
                size="sm"
                variant={applyMode === 'insert' ? 'default' : 'ghost'}
                onClick={() => setApplyMode('insert')}
                className={`${panelTokens.control} flex-1 rounded-lg px-4 sm:flex-none`}
              >
                Chèn vào vị trí con trỏ
              </Button>
              <Button
                type="button"
                size="sm"
                variant={applyMode === 'replace' ? 'default' : 'ghost'}
                onClick={() => setApplyMode('replace')}
                className={`${panelTokens.control} flex-1 rounded-lg px-4 sm:flex-none`}
              >
                Thay toàn bộ mẫu
              </Button>
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/35 bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                {selectedIds.length} dòng đã chọn
              </span>
              <span className="rounded-full border border-border/35 bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                {applyMode === 'insert' ? 'Chèn vào vị trí con trỏ' : 'Thay toàn bộ mẫu'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <AlertDialogCancel className={`${panelTokens.control} min-w-[104px] rounded-lg px-4`}>Đóng</AlertDialogCancel>
            <Button
              type="button"
              onClick={handleApply}
              disabled={!selectedIds.length}
              className={`${panelTokens.control} min-w-[196px] rounded-lg px-5`}
            >
              Chèn vào mẫu nội dung
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
