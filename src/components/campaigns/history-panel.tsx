import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Clock, Download, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useComposerStore } from '@/stores/use-composer-store';
import type { Campaign } from '@/lib/types/domain';

const statusLabel: Record<string, string> = {
  draft: 'Nháp',
  running: 'Đang chạy',
  completed: 'Hoàn tất',
  stopped: 'Đã dừng',
  failed: 'Thất bại'
};

const statusVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  completed: 'success',
  failed: 'destructive',
  running: 'warning',
  stopped: 'warning',
  draft: 'secondary'
};

type HistoryFilter = 'all' | 'running' | 'completed' | 'failed' | 'stopped';

const filterLabel: Record<HistoryFilter, string> = {
  all: 'Tất cả',
  running: 'Đang chạy',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  stopped: 'Đã dừng'
};

const isCampaignLike = (value: unknown): value is Campaign => {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).id === 'string';
};

const formatDateSafe = (value?: string): string => {
  if (!value) return 'Không rõ thời gian';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : 'Không rõ thời gian';
};

const deriveDryRunSuccessCount = (campaign: Campaign): number => {
  if (!campaign.dryRun) return 0;
  const inferred = Math.max(0, campaign.totalTargets - campaign.failedCount - campaign.skippedCount);
  return Math.max(campaign.sentCount, inferred);
};

export function HistoryPanel(): JSX.Element {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const history = useCampaignStore((state) => state.history);
  const historyLoading = useCampaignStore((state) => state.historyLoading);
  const historyError = useCampaignStore((state) => state.historyError);
  const loadHistory = useCampaignStore((state) => state.loadHistory);
  const openCampaign = useCampaignStore((state) => state.openCampaign);
  const exportCampaignCsv = useCampaignStore((state) => state.exportCampaignCsv);
  const deleteCampaign = useCampaignStore((state) => state.deleteCampaign);
  const applyCampaignContent = useComposerStore((state) => state.applyCampaignContent);
  const composerImagePath = useComposerStore((state) => state.imagePath);
  const composerCaptionTemplate = useComposerStore((state) => state.captionTemplate);
  const composerIntroText = useComposerStore((state) => state.introText);
  const composerTitleText = useComposerStore((state) => state.titleText);
  const composerFooterText = useComposerStore((state) => state.footerText);
  const composerPlainTextFallback = useComposerStore((state) => state.plainTextFallback);

  const safeHistory = useMemo(() => history.filter(isCampaignLike), [history]);
  const filteredHistory = useMemo(
    () => (filter === 'all' ? safeHistory : safeHistory.filter((item) => item.status === filter)),
    [filter, safeHistory]
  );
  const filterCounts = useMemo(() => {
    const counts: Record<HistoryFilter, number> = { all: safeHistory.length, running: 0, completed: 0, failed: 0, stopped: 0 };
    safeHistory.forEach((item) => {
      if (item.status === 'running') counts.running += 1;
      if (item.status === 'completed') counts.completed += 1;
      if (item.status === 'failed') counts.failed += 1;
      if (item.status === 'stopped') counts.stopped += 1;
    });
    return counts;
  }, [safeHistory]);

  const hasComposerDraft =
    Boolean(composerImagePath) ||
    Boolean(composerCaptionTemplate.trim()) ||
    Boolean(composerIntroText.trim()) ||
    Boolean(composerTitleText.trim()) ||
    Boolean(composerFooterText.trim()) ||
    Boolean(composerPlainTextFallback.trim());

  const onRetryHistory = async () => {
    try { setActionError(null); await loadHistory(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể tải lại lịch sử'); }
  };

  const onOpenCampaign = async (campaignId: string) => {
    try { setActionError(null); await openCampaign(campaignId); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể mở chi tiết chiến dịch'); }
  };

  const onExportCsv = async (campaignId: string) => {
    try { setActionError(null); await exportCampaignCsv(campaignId); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể xuất CSV'); }
  };

  const onDeleteCampaign = async (campaignId: string) => {
    try { setActionError(null); await deleteCampaign(campaignId); await loadHistory(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Không thể xóa chiến dịch'); }
  };

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-sm font-semibold leading-none text-foreground">
              Chiến dịch gần đây
            </CardTitle>
          </div>
          {safeHistory.length > 0 && (
            <span className="rounded-full border border-border/35 bg-background/50 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {safeHistory.length}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3 space-y-3">
        {/* Filter tabs — segmented control */}
        <div className={cn(panelTokens.toolbar, 'flex w-full overflow-x-auto p-1')}>
          {(Object.keys(filterLabel) as HistoryFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium tabular-nums transition-all',
                filter === key
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {filterLabel[key]}
              {filterCounts[key] > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px]',
                  filter === key ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground'
                )}>
                  {filterCounts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {actionError ? (
            <div className="rounded-lg border border-destructive/35 bg-destructive/[0.08] px-3 py-2 text-xs text-destructive">
              {actionError}
            </div>
          ) : null}

          {historyLoading ? (
            <div className="rounded-lg border border-border/30 bg-muted/[0.06] px-3 py-6 text-center text-sm text-muted-foreground">
              Đang tải lịch sử chiến dịch...
            </div>
          ) : historyError ? (
            <div className="space-y-2 rounded-lg border border-destructive/35 bg-destructive/[0.08] px-3 py-2.5">
              <p className="text-xs text-destructive">{historyError}</p>
              <Button variant="outline" className={`${panelTokens.control} px-3`} onClick={() => void onRetryHistory()}>
                Tải lại
              </Button>
            </div>
          ) : filteredHistory.length > 0 ? (
            filteredHistory.map((item) => {
              const sentCount = item.dryRun ? deriveDryRunSuccessCount(item) : item.sentCount;
              const durationSec = item.finishedAt && item.startedAt
                ? Math.max(1, dayjs(item.finishedAt).diff(dayjs(item.startedAt), 'second'))
                : null;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/30 bg-muted/[0.06] p-3 transition-colors hover:border-border/45 hover:bg-muted/10"
                >
                  {/* Title row */}
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground" title={item.name || item.id}>
                        {item.name || item.id}
                      </p>
                      {item.name && item.name !== item.id ? (
                        <p className="truncate font-mono text-[10px] text-muted-foreground/70">{item.id}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.dryRun ? (
                        <Badge variant="outline" className="h-4 px-1.5 text-[9px]">thử</Badge>
                      ) : null}
                      <Badge
                        variant={statusVariant[item.status] ?? 'secondary'}
                        className="whitespace-nowrap"
                      >
                        {statusLabel[item.status] ?? item.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{formatDateSafe(item.startedAt)}</span>
                    {durationSec ? (
                      <>
                        <span className="text-border/60">·</span>
                        <span className="tabular-nums">{durationSec}s</span>
                      </>
                    ) : null}
                    <span className="text-border/60">·</span>
                    <span className="tabular-nums">{item.totalTargets} nhóm</span>
                  </div>

                  {/* Stats row */}
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="tabular-nums">
                      <span className="font-semibold text-foreground">{sentCount}</span>
                      <span className="ml-1 text-muted-foreground">{item.dryRun ? 'thử' : 'gửi'}</span>
                    </span>
                    <span className="tabular-nums">
                      <span className={cn('font-semibold', item.failedCount > 0 ? 'text-destructive' : 'text-foreground')}>
                        {item.failedCount}
                      </span>
                      <span className="ml-1 text-muted-foreground">lỗi</span>
                    </span>
                    <span className="tabular-nums">
                      <span className="font-semibold text-foreground">{item.skippedCount}</span>
                      <span className="ml-1 text-muted-foreground">bỏ qua</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className={`${panelTokens.control} flex-1 px-3 font-medium`}
                      onClick={() => void onOpenCampaign(item.id)}
                    >
                      Mở
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className={`${panelTokens.control} flex-1 px-3`}
                      onClick={() => {
                        if (hasComposerDraft && !window.confirm('Đang có nội dung soạn thảo. Ghi đè?')) return;
                        applyCampaignContent(item);
                      }}
                    >
                      Dùng lại
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${panelTokens.control} w-9 px-0`}
                      onClick={() => void onExportCsv(item.id)}
                      title="Xuất CSV"
                      aria-label="Xuất CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${panelTokens.control} w-9 border-destructive/35 px-0 text-destructive hover:bg-destructive/10 hover:border-destructive/50 disabled:pointer-events-none`}
                      onClick={() => {
                        if (item.status === 'running') { setActionError('Không thể xóa chiến dịch đang chạy'); return; }
                        if (window.confirm(`Xóa chiến dịch "${item.name}"? Không thể hoàn tác.`)) {
                          void onDeleteCampaign(item.id);
                        }
                      }}
                      disabled={item.status === 'running'}
                      title="Xóa chiến dịch"
                      aria-label="Xóa chiến dịch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-border/40 bg-muted/[0.06] px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {safeHistory.length > 0
                  ? 'Không có chiến dịch khớp bộ lọc hiện tại.'
                  : 'Chưa có chiến dịch nào. Hãy chạy chiến dịch đầu tiên.'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
