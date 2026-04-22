import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { quickContentItemsRepo } from '@/lib/db/repositories';
import type { QuickContentItem } from '@/lib/types/domain';

const splitRawQuickContentInput = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeQuickContentValue = (value: string): string =>
  value
    .trim()
    .replace(/\s*\/+\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export function useQuickContentEntries({ open }: { open: boolean }) {
  const [items, setItems] = useState<QuickContentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return items;
    }
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedSearch) ||
        item.content.toLowerCase().includes(normalizedSearch)
    );
  }, [items, searchTerm]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const selectedContent = useMemo(
    () => selectedItems.map((item) => item.content.trim()).filter(Boolean).join('\n'),
    [selectedItems]
  );

  const visibleItemIds = filteredItems.map((item) => item.id);

  const toggleSelection = (itemId: string, checked: boolean | 'indeterminate'): void => {
    setSelectedIds((current) => {
      if (checked === true) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((id) => id !== itemId);
    });
  };

  const handleItemPress = (itemId: string): void => {
    toggleSelection(itemId, !selectedIds.includes(itemId));
  };

  const addLinesAsItems = async (rawContent: string): Promise<{ createdCount: number; duplicateCount: number }> => {
    const rawLines = splitRawQuickContentInput(rawContent);
    if (rawLines.length === 0) {
      throw new Error('Nội dung không được để trống.');
    }

    setSaving(true);
    setError(null);
    try {
      const createdItems: QuickContentItem[] = [];
      const existingValues = new Set(items.map((item) => normalizeQuickContentValue(item.content)));
      const seenInBatch = new Set<string>();
      let duplicateCount = 0;

      for (const rawLine of rawLines) {
        const content = rawLine.trim();
        if (!content) {
          continue;
        }

        const normalizedValue = normalizeQuickContentValue(content);
        if (!normalizedValue || existingValues.has(normalizedValue) || seenInBatch.has(normalizedValue)) {
          duplicateCount += 1;
          continue;
        }

        const created = await quickContentItemsRepo.create({ label: content, content });
        createdItems.push(created);
        seenInBatch.add(normalizedValue);
        existingValues.add(normalizedValue);
      }

      if (createdItems.length === 0) {
        throw new Error(
          duplicateCount > 0
            ? 'Tất cả các dòng đều đã tồn tại hoặc bị trùng lặp.'
            : 'Không có dòng hợp lệ để thêm vào thư viện dòng mẫu.'
        );
      }

      setItems((current) => [...current, ...createdItems]);
      setSelectedIds((current) => [...current, ...createdItems.map((item) => item.id)]);
      return { createdCount: createdItems.length, duplicateCount };
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (id: string, label: string, content: string): Promise<void> => {
    const nextLabel = label.trim();
    const nextContent = content.trim();
    if (!nextLabel || !nextContent) {
      throw new Error('Tên dòng mẫu và nội dung không được để trống.');
    }

    setSaving(true);
    setError(null);
    try {
      await quickContentItemsRepo.update(id, { label: nextLabel, content: nextContent });
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, label: nextLabel, content: nextContent, updatedAt: new Date().toISOString() }
            : item
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await quickContentItemsRepo.remove(itemId);
      setItems((current) => current.filter((item) => item.id !== itemId));
      setSelectedIds((current) => current.filter((id) => id !== itemId));
    } finally {
      setSaving(false);
    }
  };

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
    const normalizedItems = nextItems.map((item, index) => ({ ...item, sortOrder: index }));

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

  return {
    items,
    selectedIds,
    setSelectedIds,
    loading,
    saving,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    filteredItems,
    selectedItems,
    selectedContent,
    visibleItemIds,
    draggingId,
    dropTargetId,
    toggleSelection,
    handleItemPress,
    addLinesAsItems,
    updateItem,
    removeItem,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  };
}
