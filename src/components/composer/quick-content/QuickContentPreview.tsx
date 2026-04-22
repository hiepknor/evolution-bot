import { Button } from '@/components/ui/button';
import { AlertDialogCancel } from '@/components/ui/alert-dialog';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import type { ApplyMode } from '@/components/composer/quick-content/types';

export function QuickContentPreview({
  applyMode,
  setApplyMode,
  selectedCount,
  hasSelection,
  onApply,
  previewText
}: {
  applyMode: ApplyMode;
  setApplyMode: (mode: ApplyMode) => void;
  selectedCount: number;
  hasSelection: boolean;
  onApply: () => void;
  previewText: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border/45 bg-background/35 px-5 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <div className={cn(panelTokens.toolbar, 'inline-flex w-full flex-wrap p-1 sm:w-auto')}>
          <Button type="button" size="sm" variant={applyMode === 'insert' ? 'default' : 'ghost'} onClick={() => setApplyMode('insert')} className={`${panelTokens.control} flex-1 rounded-lg px-4 sm:flex-none`}>
            Chèn vào vị trí con trỏ
          </Button>
          <Button type="button" size="sm" variant={applyMode === 'replace' ? 'default' : 'ghost'} onClick={() => setApplyMode('replace')} className={`${panelTokens.control} flex-1 rounded-lg px-4 sm:flex-none`}>
            Thay toàn bộ mẫu
          </Button>
        </div>
        <div className="flex min-h-10 flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/35 bg-background/55 px-3 py-1 text-xs text-muted-foreground">{selectedCount} dòng đã chọn</span>
          <span className="rounded-full border border-border/35 bg-background/55 px-3 py-1 text-xs text-muted-foreground">{applyMode === 'insert' ? 'Chèn vào vị trí con trỏ' : 'Thay toàn bộ mẫu'}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <AlertDialogCancel className={`${panelTokens.control} min-w-[104px] rounded-lg px-4`}>Đóng</AlertDialogCancel>
        <Button type="button" onClick={onApply} disabled={!hasSelection} className={`${panelTokens.control} min-w-[196px] rounded-lg px-5`}>
          Chèn vào mẫu nội dung
        </Button>
      </div>
      {previewText ? (
        <div className="w-full rounded-lg border border-border/35 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          Xem nhanh: {previewText}
        </div>
      ) : null}
    </div>
  );
}
