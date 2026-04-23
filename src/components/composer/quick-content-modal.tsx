import { X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { panelTokens } from '@/components/layout/panel-tokens';
import { QuickContentEditor } from '@/components/composer/quick-content/QuickContentEditor';
import { QuickContentList } from '@/components/composer/quick-content/QuickContentList';
import { QuickContentPreview } from '@/components/composer/quick-content/QuickContentPreview';
import { useQuickContentEntries } from '@/components/composer/quick-content/hooks/use-quick-content-entries';
import { useQuickContentForm } from '@/components/composer/quick-content/hooks/use-quick-content-form';
import type { QuickContentModalProps } from '@/components/composer/quick-content/types';

export function QuickContentModal({ open, onOpenChange, onApply }: QuickContentModalProps): JSX.Element {
  const entries = useQuickContentEntries({ open });
  const form = useQuickContentForm({
    selectedIds: entries.selectedIds,
    selectedContent: entries.selectedContent,
    onApply,
    onOpenChange,
    addLinesAsItems: entries.addLinesAsItems,
    updateItem: entries.updateItem,
    removeItem: entries.removeItem,
    setError: entries.setError
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex h-[86vh] max-h-[86vh] max-w-6xl flex-col overflow-hidden border-border/50 bg-card p-0">
        <AlertDialogHeader className="border-b border-border/50 bg-card/95 px-5 pb-3 pt-3.5 backdrop-blur-sm">
          <div className="space-y-1 pr-12">
            <AlertDialogTitle className={panelTokens.modalTitle}>Chọn dòng mẫu để chèn vào nội dung</AlertDialogTitle>
            <AlertDialogDescription className={panelTokens.bodyText}>
              Tìm trong thư viện dòng mẫu, chọn nội dung cần dùng và chèn trực tiếp vào phần mẫu nội dung đang soạn.
            </AlertDialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-3.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/55 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Đóng modal"
            title="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </AlertDialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-2 pt-3.5">
          <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.42fr)] xl:items-start">
            <QuickContentEditor
              itemsCount={entries.items.length}
              createContent={form.createContent}
              setCreateContent={form.setCreateContent}
              onCreate={() => {
                void form.handleCreate();
              }}
              onCreateInputKeyDown={form.handleCreateInputKeyDown}
              saving={entries.saving}
              error={entries.error}
            />
            <QuickContentList
              loading={entries.loading}
              saving={entries.saving}
              items={entries.items}
              filteredItems={entries.filteredItems}
              selectedIds={entries.selectedIds}
              visibleItemIds={entries.visibleItemIds}
              searchTerm={entries.searchTerm}
              setSearchTerm={entries.setSearchTerm}
              editingId={form.editingId}
              editingContent={form.editingContent}
              setEditingContent={form.setEditingContent}
              setEditingLabel={form.setEditingLabel}
              editingInputRef={form.editingInputRef}
              draggingId={entries.draggingId}
              dropTargetId={entries.dropTargetId}
              toggleSelection={entries.toggleSelection}
              handleItemPress={entries.handleItemPress}
              onSelectAllVisible={() => entries.setSelectedIds(Array.from(new Set([...entries.selectedIds, ...entries.visibleItemIds])))}
              onClearSelection={() => entries.setSelectedIds([])}
              onStartEditing={form.startEditing}
              onCancelEditing={form.cancelEditing}
              onSaveEditing={() => {
                void form.handleSaveEdit();
              }}
              onDeleteItem={(itemId) => {
                void form.handleDelete(itemId);
              }}
              onInlineEditKeyDown={form.handleInlineEditKeyDown}
              onDragStart={entries.handleDragStart}
              onDragOver={entries.handleDragOver}
              onDrop={(event, itemId) => {
                void entries.handleDrop(event, itemId);
              }}
              onDragEnd={entries.handleDragEnd}
            />
          </div>
        </div>

        <QuickContentPreview
          applyMode={form.applyMode}
          setApplyMode={form.setApplyMode}
          selectedCount={entries.selectedIds.length}
          hasSelection={form.hasSelection}
          onApply={form.handleApply}
          previewText={form.previewText}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
