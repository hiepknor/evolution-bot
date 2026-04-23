import dayjs from 'dayjs';
import { AlertCircle, Clock, Send, Tag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useSettingsStore } from '@/stores/use-settings-store';

const formatRemainingTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const formatCampaignDuration = (startedAt?: string, finishedAt?: string): string => {
  if (!startedAt || !finishedAt) {
    return '-';
  }
  const start = dayjs(startedAt);
  const end = dayjs(finishedAt);
  if (!start.isValid() || !end.isValid()) {
    return '-';
  }
  return formatRemainingTime(Math.max(0, end.diff(start)));
};

export function FooterStatus(): JSX.Element {
  const activeCampaign = useCampaignStore((state) => state.activeCampaign);
  const progress = useCampaignStore((state) => state.queueProgress);
  const running = useCampaignStore((state) => state.running);
  const paused = useCampaignStore((state) => state.paused);
  const stopping = useCampaignStore((state) => state.stopping);
  const badgeState = useSettingsStore((state) => state.badgeState);
  const [liveEtaMs, setLiveEtaMs] = useState<number>(0);
  const etaAnchorRef = useRef<{ baseMs: number; startedAtMs: number } | null>(null);

  const percent = progress && progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  const roundedPercent = Number.isFinite(percent) ? Math.round(percent) : 0;
  const processed = progress?.processed ?? 0;
  const total = progress?.total ?? 0;
  const failedCount = progress?.failed ?? 0;
  const skippedCount = progress?.skipped ?? 0;
  const sentCount = progress?.sent ?? 0;
  const dryRunCount = progress?.dryRunSuccess ?? 0;
  const campaignStatus = activeCampaign?.status ?? 'draft';
  const liveMode = running || stopping;
  const finishedMode = !liveMode && ['completed', 'failed', 'stopped'].includes(campaignStatus);
  const showLastRunHint = finishedMode && badgeState === 'disconnected';

  const campaignStatusLabel =
    stopping
      ? 'Đang dừng'
      : campaignStatus === 'running'
        ? paused
          ? 'Tạm dừng'
          : 'Đang chạy'
        : campaignStatus === 'completed'
          ? 'Hoàn tất'
          : campaignStatus === 'failed'
            ? 'Thất bại'
            : campaignStatus === 'stopped'
              ? 'Đã dừng'
              : 'Nhàn rỗi';

  const campaignStatusVariant =
    stopping || campaignStatus === 'running'
      ? 'warning'
      : campaignStatus === 'completed'
        ? 'success'
        : campaignStatus === 'failed'
          ? 'destructive'
          : campaignStatus === 'stopped'
            ? 'warning'
            : 'secondary';

  useEffect(() => {
    if (!liveMode || !progress) {
      etaAnchorRef.current = null;
      setLiveEtaMs(0);
      return;
    }

    if (paused) {
      etaAnchorRef.current = null;
      setLiveEtaMs(Math.max(0, progress.etaMs));
      return;
    }

    const baseMs = Math.max(0, progress.etaMs);
    etaAnchorRef.current = { baseMs, startedAtMs: Date.now() };
    setLiveEtaMs(baseMs);
  }, [liveMode, paused, progress, progress?.campaignId, progress?.processed, progress?.total, progress?.etaMs]);

  useEffect(() => {
    if (!running || paused || stopping) {
      return;
    }

    const timer = window.setInterval(() => {
      const anchor = etaAnchorRef.current;
      if (!anchor) {
        return;
      }
      const elapsed = Date.now() - anchor.startedAtMs;
      const next = Math.max(0, anchor.baseMs - elapsed);
      setLiveEtaMs(next);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [paused, running, stopping]);

  const etaDisplay = liveMode
    ? paused
      ? `Tạm dừng (${formatRemainingTime(liveEtaMs)})`
      : stopping
        ? 'Đang dừng...'
        : liveEtaMs <= 5000 && processed < total
          ? 'Sắp hoàn tất...'
          : formatRemainingTime(liveEtaMs)
    : '-';

  const durationDisplay = finishedMode
    ? formatCampaignDuration(activeCampaign?.startedAt, activeCampaign?.finishedAt)
    : '-';
  const campaignName = activeCampaign?.name?.trim() || '';
  const campaignDisplay = campaignName || activeCampaign?.id || '-';
  const campaignTitle = activeCampaign
    ? `Tên: ${campaignName || '(chưa đặt)'}\nID: ${activeCampaign.id}`
    : '-';

  const hasError = failedCount > 0;

  return (
    <footer className="border-t border-border/65 bg-card/62 px-4 py-3 backdrop-blur">
      {/* Progress row */}
      <div className="mb-2.5 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {total > 0 ? (
            <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground/85">
              {roundedPercent}%
            </span>
          ) : null}
          <Progress value={percent} className="h-1.5 flex-1" />
          {total > 0 ? (
            <span className="shrink-0 text-[11px] tabular-nums text-foreground/68">
              {processed}/{total}
            </span>
          ) : (
            <span className="text-[11px] text-foreground/65">Chưa có chiến dịch</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showLastRunHint ? (
            <span className="text-[10px] text-foreground/65">Lần chạy gần nhất</span>
          ) : null}
          <Badge
            variant={campaignStatusVariant}
            className="h-5 min-w-[80px] justify-center rounded-full px-2.5 text-[10px] font-semibold"
          >
            {campaignStatusLabel}
          </Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {/* Đã gửi */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-background/32 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
            <Send className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-foreground/64">Đã gửi</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-sm font-semibold tabular-nums text-foreground">{sentCount}</span>
              {dryRunCount > 0 && (
                <span className="text-[10px] text-foreground/62">{dryRunCount} thử</span>
              )}
            </div>
          </div>
        </div>

        {/* Lỗi / bỏ qua */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-background/32 px-3 py-2">
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              hasError ? 'bg-destructive/10 text-destructive' : 'bg-muted/40 text-muted-foreground'
            )}
          >
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-foreground/64">Lỗi / bỏ qua</p>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  hasError ? 'text-destructive' : 'text-foreground'
                )}
              >
                {failedCount}
              </span>
              <span className="text-[10px] text-foreground/62">/ {skippedCount}</span>
            </div>
          </div>
        </div>

        {/* Thời gian */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-background/32 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-foreground/64">
              {finishedMode ? 'Thời lượng' : 'Còn lại'}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
              {finishedMode ? durationDisplay : etaDisplay}
            </p>
          </div>
        </div>

        {/* Chiến dịch */}
        <div
          className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-background/32 px-3 py-2"
          title={campaignTitle}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/40 text-accent-foreground">
            <Tag className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-foreground/64">Chiến dịch</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{campaignDisplay}</p>
            <p className="text-[10px] text-foreground/62">
              {finishedMode
                ? `Xong ${activeCampaign?.finishedAt ? dayjs(activeCampaign.finishedAt).format('HH:mm:ss') : '-'}`
                : `Từ ${activeCampaign?.startedAt ? dayjs(activeCampaign.startedAt).format('HH:mm:ss') : '-'}`}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
