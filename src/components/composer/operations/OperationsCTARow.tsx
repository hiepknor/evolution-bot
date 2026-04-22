import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { panelTokens } from '@/components/layout/panel-tokens';

interface OperationsCTARowProps {
  selectedCount: number;
  effectiveTargetCount: number;
  permissionAllowedCount: number;
  executionBlocked: boolean;
  executionDisabledReason: string | null;
  executionBadgeHint: string | null;
  running: boolean;
  stopping: boolean;
  paused: boolean;
  hasActiveCampaign: boolean;
  onDryRun: () => void;
  onSend: () => void;
  onExportCsv: () => void;
}

export function OperationsCTARow({
  selectedCount,
  effectiveTargetCount,
  permissionAllowedCount,
  executionBlocked,
  executionDisabledReason,
  executionBadgeHint,
  running,
  stopping,
  paused,
  hasActiveCampaign,
  onDryRun,
  onSend,
  onExportCsv
}: OperationsCTARowProps): JSX.Element {
  return (
    <div className={panelTokens.section}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Đang áp dụng</p>
          <div className="flex items-center gap-2">
            {executionBadgeHint ? <Badge variant="warning">{executionBadgeHint}</Badge> : null}
            {running || stopping ? (
              <Badge variant="warning">{stopping ? 'đang dừng' : paused ? 'tạm dừng' : 'đang chạy'}</Badge>
            ) : (
              <Badge variant="secondary">sẵn sàng</Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <div className="flex min-h-20 flex-col justify-between rounded-lg border border-border/25 bg-muted/10 px-3 py-2">
            <p className="text-[11px] text-foreground/70">Đã chọn</p>
            <p className="text-lg font-semibold leading-none text-foreground">{selectedCount}</p>
          </div>
          <div className="flex min-h-20 flex-col justify-between rounded-lg border border-border/25 bg-muted/10 px-3 py-2">
            <p className="text-[11px] text-foreground/70">Hợp lệ theo danh sách</p>
            <p className="text-lg font-semibold leading-none text-foreground">{effectiveTargetCount}</p>
          </div>
          <div className="flex min-h-20 flex-col justify-between rounded-lg border border-border/25 bg-muted/10 px-3 py-2">
            <p className="text-[11px] text-foreground/70">Có quyền gửi</p>
            <p className="text-lg font-semibold leading-none text-foreground">{permissionAllowedCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          variant="default"
          onClick={onSend}
          disabled={executionBlocked}
          title={executionDisabledReason ?? `Gửi tới ${effectiveTargetCount} nhóm`}
          className={`${panelTokens.control} font-semibold shadow-[0_8px_24px_-16px_hsl(var(--primary))]`}
        >
          Gửi hàng loạt
        </Button>
        <Button
          variant="secondary"
          onClick={onDryRun}
          disabled={executionBlocked}
          title={executionDisabledReason ?? 'Chạy thử chiến dịch'}
          className={panelTokens.control}
        >
          Chạy thử
        </Button>
        <Button
          variant="secondary"
          onClick={onExportCsv}
          disabled={!hasActiveCampaign}
          className={panelTokens.control}
        >
          Xuất CSV
        </Button>
      </div>
    </div>
  );
}
