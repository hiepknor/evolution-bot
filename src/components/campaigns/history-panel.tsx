import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useComposerStore } from '@/stores/use-composer-store';
import type { Campaign } from '@/lib/types/domain';

const statusLabel: Record<string, string> = {
  draft: 'nháp',
  running: 'đang chạy',
  completed: 'hoàn tất',
  stopped: 'đã dừng',
  failed: 'thất bại'
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
  if (!value || typeof value !== 'object') {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return typeof rec.id === 'string';
};

const formatDateSafe = (value?: string): string => {
  if (!value) {
    return 'Không rõ thời gian';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : 'Không rõ thời gian';
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
  const hasComposerDraft =
    Boolean(composerImagePath) ||
    Boolean(composerCaptionTemplate.trim()) ||
    Boolean(composerIntroText.trim()) ||
    Boolean(composerTitleText.trim()) ||
    Boolean(composerFooterText.trim()) ||
    Boolean(composerPlainTextFallback.trim());
  const onRetryHistory = async () => {
    try {
      setActionError(null);
      await loadHistory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể tải lại lịch sử');
    }
  };

  const onOpenCampaign = async (campaignId: string) => {
    try {
      setActionError(null);
      await openCampaign(campaignId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể mở chi tiết chiến dịch');
    }
  };

  const onExportCsv = async (campaignId: string) => {
    try {
      setActionError(null);
      await exportCampaignCsv(campaignId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể xuất CSV cho chiến dịch');
    }
  };

  const onDeleteCampaign = async (campaignId: string) => {
    try {
      setActionError(null);
      await deleteCampaign(campaignId);
      await loadHistory();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể xóa chiến dịch');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Chiến dịch gần đây</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(filterLabel) as HistoryFilter[]).map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? 'default' : 'secondary'}
              className="h-8 rounded-full px-2.5 text-xs whitespace-nowrap"
              onClick={() => setFilter(key)}
            >
              {filterLabel[key]}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          {actionError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {actionError}
            </div>
          ) : null}
          {historyLoading ? (
            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              Đang tải lịch sử chiến dịch...
            </div>
          ) : historyError ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <p>{historyError}</p>
              <Button size="sm" variant="outline" onClick={() => void onRetryHistory()}>
                Tải lại
              </Button>
            </div>
          ) : filteredHistory.length > 0 ? (
            filteredHistory.map((item) => (
              <div key={item.id} className="rounded-md border border-border/70 bg-muted/10 p-2.5 text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.name || item.id}</p>
                    {item.name !== item.id ? (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{item.id}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      item.status === 'completed'
                        ? 'success'
                        : item.status === 'failed'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {statusLabel[item.status] ?? item.status}
                  </Badge>
                </div>
                <div className="mb-2 text-muted-foreground">
                  {formatDateSafe(item.startedAt)} • tổng {item.totalTargets}
                  {item.finishedAt && item.startedAt ? ` • ${Math.max(1, dayjs(item.finishedAt).diff(dayjs(item.startedAt), 'second'))}s` : ''}
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="success">gửi: {item.sentCount}</Badge>
                  <Badge variant="destructive">lỗi: {item.failedCount}</Badge>
                  <Badge variant="secondary">bỏ qua: {item.skippedCount}</Badge>
                  {item.dryRun ? <Badge variant="outline">chạy thử</Badge> : null}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      size="sm"
                      className="h-8 justify-center px-3 text-xs font-semibold"
                      onClick={() => void onOpenCampaign(item.id)}
                    >
                      Mở
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 justify-center px-3 text-xs"
                      onClick={() => {
                        if (
                          hasComposerDraft &&
                          !window.confirm('Đang có nội dung soạn thảo. Ghi đè bằng nội dung chiến dịch này?')
                        ) {
                          return;
                        }
                        applyCampaignContent(item);
                      }}
                    >
                      Dùng lại
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => void onExportCsv(item.id)}
                    >
                      Xuất
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (item.status === 'running') {
                          setActionError('Không thể xóa chiến dịch đang chạy');
                          return;
                        }
                        if (window.confirm(`Xóa chiến dịch "${item.name}"? Hành động này không thể hoàn tác.`)) {
                          void onDeleteCampaign(item.id);
                        }
                      }}
                      disabled={item.status === 'running'}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              {safeHistory.length > 0
                ? 'Không có chiến dịch khớp bộ lọc hiện tại.'
                : 'Chưa có chiến dịch nào trong lịch sử. Hãy chạy chiến dịch đầu tiên.'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
