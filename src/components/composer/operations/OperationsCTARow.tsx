import { Download, ListFilter, Send, ShieldCheck, SquareCheck } from 'lucide-react';

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
  const statusBadge = running || stopping
    ? stopping ? 'đang dừng' : paused ? 'tạm dừng' : 'đang chạy'
    : null;

  return (
    <div className={panelTokens.section}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className={panelTokens.sectionTitle}>Đang áp dụng</p>
        <div className="flex items-center gap-1.5">
          {executionBadgeHint ? <Badge variant="warning">{executionBadgeHint}</Badge> : null}
          {statusBadge ? (
            <Badge variant="warning">{statusBadge}</Badge>
          ) : (
            <Badge variant="secondary">sẵn sàng</Badge>
          )}
        </div>
      </div>

      {/* Stat cards — centered, number as hero */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border/35 bg-background/40 px-2 py-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SquareCheck className="h-3 w-3" />
          </div>
          <p className="text-[10px] text-muted-foreground">Đã chọn</p>
          <p className="text-base font-semibold tabular-nums leading-none text-foreground">{selectedCount}</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border/35 bg-background/40 px-2 py-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/40 text-accent-foreground">
            <ListFilter className="h-3 w-3" />
          </div>
          <p className="text-[10px] text-muted-foreground">Hợp lệ</p>
          <p className="text-base font-semibold tabular-nums leading-none text-foreground">{effectiveTargetCount}</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border/35 bg-background/40 px-2 py-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-success/10 text-success">
            <ShieldCheck className="h-3 w-3" />
          </div>
          <p className="text-[10px] text-muted-foreground">Quyền gửi</p>
          <p className="text-base font-semibold tabular-nums leading-none text-foreground">{permissionAllowedCount}</p>
        </div>
      </div>

      {/* Action buttons — primary full width, 2 secondary below */}
      <div className="space-y-2">
        <Button
          variant="default"
          onClick={onSend}
          disabled={executionBlocked}
          title={executionDisabledReason ?? `Gửi tới ${effectiveTargetCount} nhóm`}
          className={`${panelTokens.control} w-full gap-2 font-semibold shadow-[0_8px_24px_-16px_hsl(var(--primary))]`}
        >
          <Send className="h-3.5 w-3.5" />
          Gửi hàng loạt
        </Button>
        <div className="grid grid-cols-2 gap-2">
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
            variant="outline"
            onClick={onExportCsv}
            disabled={!hasActiveCampaign}
            className={`${panelTokens.control} gap-1.5`}
          >
            <Download className="h-3.5 w-3.5" />
            Xuất CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
