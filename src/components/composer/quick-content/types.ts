import type { QuickContentItem } from '@/lib/types/domain';

export type ApplyMode = 'insert' | 'replace';

export interface QuickContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (content: string, mode: ApplyMode) => void;
}

export interface QuickContentEditingState {
  editingId: string | null;
  editingLabel: string;
  editingContent: string;
}

export interface QuickContentItemView extends QuickContentItem {
  isSelected: boolean;
  isEditing: boolean;
}
