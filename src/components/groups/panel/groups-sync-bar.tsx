import { RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { panelTokens } from '@/components/layout/panel-tokens';

interface GroupsSyncBarProps {
  visibleSummary: string;
  listModeLabel: string;
  listModeShortLabel: string;
  blacklistLength: number;
  groupsIgnoreFlag: boolean | null;
  activeCampaignLabel: string;
  activeCampaignTitle: string;
  isConnectionBlocked: boolean;
  canTriggerConnectionCta: boolean;
  syncButtonDisabled: boolean;
  syncButtonTitle: string;
  syncButtonLabel: string;
  isSyncLoading: boolean;
  hasGroups: boolean;
  clearCachePending: boolean;
  onSyncPrimaryAction: () => void;
  onClearCache: () => void;
  syncDisabledReason: string | null;
}

export function GroupsSyncBar({
  visibleSummary,
  listModeLabel,
  listModeShortLabel,
  blacklistLength,
  groupsIgnoreFlag,
  activeCampaignLabel,
  activeCampaignTitle,
  isConnectionBlocked,
  canTriggerConnectionCta,
  syncButtonDisabled,
  syncButtonTitle,
  syncButtonLabel,
  isSyncLoading,
  hasGroups,
  clearCachePending,
  onSyncPrimaryAction,
  onClearCache,
  syncDisabledReason
}: GroupsSyncBarProps): JSX.Element {
  return (
    <div className={panelTokens.section}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          <Badge variant="outline" className="h-6 gap-1 rounded-full px-2">
            <Users className="h-3 w-3" />
            Hiển thị: {visibleSummary}
          </Badge>
          <Badge
            variant={listModeLabel === 'Danh sách cho phép' ? 'warning' : 'secondary'}
            className="h-6 max-w-[260px] items-center justify-start rounded-full px-2 text-xs"
            title={`Chính sách gửi: ${listModeLabel.toLowerCase()} (${blacklistLength} chat id)`}
          >
            <span className="truncate">Chính sách: {listModeShortLabel} ({blacklistLength})</span>
          </Badge>
          {groupsIgnoreFlag === true ? (
            <Badge
              variant="destructive"
              className="h-6 max-w-[260px] items-center justify-start rounded-full px-2 text-xs"
              title="groups_ignore=true: Evolution API đang bỏ qua group messages"
            >
              <span className="truncate">groups_ignore: Bật</span>
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className="h-6 max-w-[300px] items-center justify-start rounded-full px-2 text-xs"
            title={activeCampaignTitle}
          >
            <span className="truncate">Theo chiến dịch: {activeCampaignLabel}</span>
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant={isConnectionBlocked ? 'outline' : 'default'}
            onClick={onSyncPrimaryAction}
            className={`${panelTokens.control} w-auto min-w-[220px] rounded-md px-4 ${
              isConnectionBlocked
                ? 'border-warning/45 bg-warning/10 text-warning hover:bg-warning/15'
                : 'bg-primary/95 text-primary-foreground shadow-[0_8px_24px_-14px_hsl(var(--primary))] hover:bg-primary'
            }`}
            disabled={syncButtonDisabled}
            title={syncButtonTitle}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncLoading ? 'animate-spin' : ''}`} />
            {syncButtonLabel}
          </Button>
          {hasGroups ? (
            <Button
              variant="outline"
              onClick={onClearCache}
              disabled={isSyncLoading || clearCachePending}
              className={`${panelTokens.control} rounded-md px-3`}
            >
              {clearCachePending ? 'Đang xóa cache...' : 'Xóa cache'}
            </Button>
          ) : null}
        </div>
      </div>
      {syncDisabledReason ? (
        <div className="mt-2 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
          <span>{syncDisabledReason}</span>
          {isConnectionBlocked && canTriggerConnectionCta ? null : null}
        </div>
      ) : null}
    </div>
  );
}
