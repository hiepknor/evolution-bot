import { AlertTriangle, RefreshCw, Shield, Tag, Users } from 'lucide-react';

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
  const isWhitelist = listModeLabel === 'Danh sách cho phép';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Info chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/40 bg-background/40 px-2.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            {visibleSummary}
          </span>
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs ${
              isWhitelist
                ? 'border-warning/35 bg-warning/8 text-warning'
                : 'border-border/40 bg-background/40 text-muted-foreground'
            }`}
            title={`Chính sách gửi: ${listModeLabel.toLowerCase()} (${blacklistLength} chat id)`}
          >
            <Shield className="h-3 w-3 shrink-0" />
            {listModeShortLabel} ({blacklistLength})
          </span>
          {groupsIgnoreFlag === true ? (
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/8 px-2.5 text-xs text-destructive"
              title="groups_ignore=true: Evolution API đang bỏ qua group messages"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              groups_ignore: Bật
            </span>
          ) : null}
          <span
            className="inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-full border border-border/40 bg-background/40 px-2.5 text-xs text-muted-foreground"
            title={activeCampaignTitle}
          >
            <Tag className="h-3 w-3 shrink-0" />
            <span className="truncate">{activeCampaignLabel}</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={isConnectionBlocked ? 'outline' : 'default'}
            onClick={onSyncPrimaryAction}
            className={`${panelTokens.control} gap-2 px-4 ${
              isConnectionBlocked
                ? 'border-warning/45 bg-warning/10 text-warning hover:bg-warning/15'
                : 'shadow-[0_8px_24px_-14px_hsl(var(--primary))]'
            }`}
            disabled={syncButtonDisabled}
            title={syncButtonTitle}
            aria-label={syncButtonLabel}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncLoading ? 'animate-spin' : ''}`} />
            {syncButtonLabel}
          </Button>
          {hasGroups ? (
            <Button
              variant="outline"
              onClick={onClearCache}
              disabled={isSyncLoading || clearCachePending}
              className={`${panelTokens.control} px-3`}
            >
              {clearCachePending ? 'Đang xóa...' : 'Xóa cache'}
            </Button>
          ) : null}
        </div>
      </div>

      {syncDisabledReason ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/[0.07] px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {syncDisabledReason}
        </div>
      ) : null}
    </div>
  );
}
