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
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/30 bg-muted/[0.08] p-2">
      <div className="text-sm text-foreground/85">Chọn nhanh (trong bộ lọc hiện tại): {selectedVisibleCount} đã chọn</div>
      {blockedVisibleCount > 0 ? (
        <Badge
          variant="warning"
          className="h-6 rounded-full px-2 text-xs"
          title={blockedSelectionDetail}
        >
          {blockedSelectionLabel}
        </Badge>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={`${panelTokens.control} rounded-full border-border/55 bg-background/35 px-3 text-foreground/90 hover:bg-muted/35`}
          onClick={onSelectAllVisible}
          disabled={selectableVisibleCount === 0}
        >
          Chọn tất cả
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`${panelTokens.control} rounded-full border-border/55 bg-background/35 px-3 text-foreground/90 hover:bg-muted/35`}
          onClick={onDeselectAllVisible}
          disabled={selectableVisibleCount === 0}
        >
          Bỏ chọn
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`${panelTokens.control} rounded-full border-border/55 bg-background/35 px-3 text-foreground/90 hover:bg-muted/35`}
          onClick={onInvertSelectionVisible}
          disabled={selectableVisibleCount === 0}
        >
          Đảo chọn
        </Button>
      </div>
    </div>
  );
}
