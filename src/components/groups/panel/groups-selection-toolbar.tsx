import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { panelTokens } from '@/components/layout/panel-tokens';

interface GroupsSelectionToolbarProps {
  selectedVisibleCount: number;
  blockedVisibleCount: number;
  blockedSelectionLabel: string;
  blockedSelectionDetail: string;
  selectableVisibleCount: number;
  onSelectAllVisible: () => void;
  onDeselectAllVisible: () => void;
  onInvertSelectionVisible: () => void;
}

export function GroupsSelectionToolbar({
  selectedVisibleCount,
  blockedVisibleCount,
  blockedSelectionLabel,
  blockedSelectionDetail,
  selectableVisibleCount,
  onSelectAllVisible,
  onDeselectAllVisible,
  onInvertSelectionVisible
}: GroupsSelectionToolbarProps): JSX.Element {
  const disabled = selectableVisibleCount === 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-2">
      <div className="flex items-center gap-2">
        {selectedVisibleCount > 0 ? (
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/[0.08] px-2.5 text-[11px] font-semibold tabular-nums text-emerald-400">
            {selectedVisibleCount} đã chọn
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Chưa chọn nhóm nào</span>
        )}
        {blockedVisibleCount > 0 ? (
          <Badge
            variant="warning"
            className="h-5 rounded-full px-2 text-[10px]"
            title={blockedSelectionDetail}
          >
            {blockedSelectionLabel}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          size="sm"
          variant="ghost"
          className={`${panelTokens.control} h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground`}
          onClick={onSelectAllVisible}
          disabled={disabled}
        >
          Chọn tất cả
        </Button>
        <span className="select-none text-border/60">·</span>
        <Button
          size="sm"
          variant="ghost"
          className={`${panelTokens.control} h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground`}
          onClick={onDeselectAllVisible}
          disabled={disabled}
        >
          Bỏ chọn
        </Button>
        <span className="select-none text-border/60">·</span>
        <Button
          size="sm"
          variant="ghost"
          className={`${panelTokens.control} h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground`}
          onClick={onInvertSelectionVisible}
          disabled={disabled}
        >
          Đảo chọn
        </Button>
      </div>
    </div>
  );
}
