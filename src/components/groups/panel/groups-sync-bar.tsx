import { AlertTriangle, RefreshCw, Shield, Tag, Trash2, Users } from 'lucide-react';

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
          {/* Group count */}
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border/35 bg-background/40 px-2.5 text-[11px] tabular-nums text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            {visibleSummary}
          </span>

          {/* List policy */}
          <span
            className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] ${
              isWhitelist
                ? 'border-warning/30 bg-warning/[0.07] text-warning'
                : 'border-border/35 bg-background/40 text-muted-foreground'
            }`}
            title={`Chính sách gửi: ${listModeLabel.toLowerCase()} (${blacklistLength} chat id)`}
          >
            <Shield className="h-3 w-3 shrink-0" />
            {listModeShortLabel}
            {blacklistLength > 0 ? (
              <span className="rounded-full bg-current/10 px-1 text-[10px] tabular-nums opacity-75">
                {blacklistLength}
              </span>
            ) : null}
          </span>

          {/* groups_ignore warning */}
          {groupsIgnoreFlag === true ? (
            <span
              className="inline-flex h-6 items-center gap-1.5 rounded-full border border-destructive/35 bg-destructive/[0.07] px-2.5 text-[11px] text-destructive"
              title="groups_ignore=true: Evolution API đang bỏ qua group messages"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              groups_ignore
            </span>
          ) : null}

          {/* Active campaign */}
          <span
            className="inline-flex h-6 max-w-[220px] items-center gap-1.5 rounded-full border border-border/35 bg-background/40 px-2.5 text-[11px] text-muted-foreground"
            title={activeCampaignTitle}
          >
            <Tag className="h-3 w-3 shrink-0" />
            <span className="truncate">{activeCampaignLabel}</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={isConnectionBlocked ? 'outline' : 'default'}
            onClick={onSyncPrimaryAction}
            className={`${panelTokens.control} gap-2 px-4 ${
              isConnectionBlocked
                ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/15'
                : 'shadow-[0_6px_20px_-12px_hsl(var(--primary))]'
            }`}
            disabled={syncButtonDisabled}
            title={syncButtonTitle}
            aria-label={syncButtonLabel}
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncLoading ? 'animate-spin' : ''}`} />
            {syncButtonLabel}
          </Button>
          {hasGroups ? (
            <Button
              variant="outline"
              size="icon"
              onClick={onClearCache}
              disabled={isSyncLoading || clearCachePending}
              className={`${panelTokens.control} w-9 border-border/40 bg-background/40 text-muted-foreground hover:border-destructive/35 hover:bg-destructive/[0.08] hover:text-destructive`}
              title={clearCachePending ? 'Đang xóa cache...' : 'Xóa cache nhóm cục bộ'}
              aria-label="Xóa cache"
            >
              {clearCachePending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {syncDisabledReason ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {syncDisabledReason}
        </div>
      ) : null}
    </div>
  );
}
