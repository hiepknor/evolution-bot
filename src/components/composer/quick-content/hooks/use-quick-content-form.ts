import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ApplyMode } from '@/components/composer/quick-content/types';

export function useQuickContentForm({
  selectedIds,
  selectedContent,
  onApply,
  onOpenChange,
  addLinesAsItems,
  updateItem,
  removeItem,
  setError
}: {
  selectedIds: string[];
  selectedContent: string;
  onApply: (content: string, mode: ApplyMode) => void;
  onOpenChange: (open: boolean) => void;
  addLinesAsItems: (rawContent: string) => Promise<{ createdCount: number; duplicateCount: number }>;
  updateItem: (id: string, label: string, content: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setError: (error: string | null) => void;
}) {
  const editingInputRef = useRef<HTMLInputElement>(null);
  const [createContent, setCreateContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [applyMode, setApplyMode] = useState<ApplyMode>('insert');

  useEffect(() => {
    if (!editingId) {
      return;
    }

    editingInputRef.current?.focus();
    editingInputRef.current?.select();
  }, [editingId]);

  const hasSelection = selectedIds.length > 0;
  const previewText = useMemo(() => selectedContent.split('\n').slice(0, 3).join('\n'), [selectedContent]);

  const handleCreate = async (): Promise<void> => {
    try {
      const result = await addLinesAsItems(createContent);
      setCreateContent('');
      if (result.duplicateCount > 0) {
        setError(`Đã thêm ${result.createdCount} dòng mới. Bỏ qua ${result.duplicateCount} dòng trùng lặp.`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể thêm dòng mẫu mới.');
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

  const startEditing = (item: { id: string; label: string; content: string }): void => {
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

    try {
      await updateItem(editingId, editingLabel, editingContent);
      cancelEditing();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật dòng mẫu.');
    }
  };

  const handleDelete = async (itemId: string): Promise<void> => {
    try {
      await removeItem(itemId);
      if (editingId === itemId) {
        cancelEditing();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xoá dòng mẫu.');
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

  return {
    editingInputRef,
    createContent,
    setCreateContent,
    editingId,
    editingLabel,
    setEditingLabel,
    editingContent,
    setEditingContent,
    applyMode,
    setApplyMode,
    hasSelection,
    previewText,
    handleCreate,
    handleCreateInputKeyDown,
    startEditing,
    cancelEditing,
    handleSaveEdit,
    handleDelete,
    handleApply,
    handleInlineEditKeyDown
  };
}
