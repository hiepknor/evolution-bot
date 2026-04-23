import { PenLine, RefreshCw } from 'lucide-react';

import { AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
    <div className="border-t border-border/50 bg-card/95 backdrop-blur-sm">
      {/* Preview text bar */}
      {previewText ? (
        <div className="border-b border-border/35 px-5 py-2">
          <p className="truncate text-[11px] text-muted-foreground">
            <span className="mr-1.5 font-medium text-foreground/60">Xem nhanh:</span>
            {previewText}
          </p>
        </div>
      ) : null}

      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        {/* Apply mode toggle */}
        <div className="flex items-center gap-2">
          <div className={cn(panelTokens.toolbar, 'inline-flex p-1')}>
            <button
              type="button"
              onClick={() => setApplyMode('insert')}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all',
                applyMode === 'insert'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <PenLine className="h-3.5 w-3.5" />
              Chèn vào con trỏ
            </button>
            <button
              type="button"
              onClick={() => setApplyMode('replace')}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all',
                applyMode === 'replace'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <RefreshCw className="h-3 w-3" />
              Thay toàn bộ mẫu
            </button>
          </div>

          {selectedCount > 0 ? (
            <span className="rounded-full border border-border/35 bg-background/55 px-2.5 py-1 text-[10px] tabular-nums text-muted-foreground">
              {selectedCount} dòng đã chọn
            </span>
          ) : null}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <AlertDialogCancel className={`${panelTokens.control} min-w-[88px] rounded-lg px-4`}>
            Đóng
          </AlertDialogCancel>
          <Button
            type="button"
            onClick={onApply}
            disabled={!hasSelection}
            className={`${panelTokens.control} min-w-[180px] rounded-lg px-5`}
          >
            Chèn vào mẫu nội dung
          </Button>
        </div>
      </div>
    </div>
  );
}
