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

function StatDivider() {
  return <span className="h-4 w-px shrink-0 bg-border/60" />;
}

function StatItem({
  icon,
  label,
  value,
  valueClass,
  sub
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground/45">{icon}</span>
      <span className="text-[10px] text-muted-foreground/50">{label}</span>
      <span className={cn('text-[11px] font-semibold tabular-nums text-foreground', valueClass)}>
        {value}
      </span>
      {sub ? <span className="text-[10px] tabular-nums text-muted-foreground/45">{sub}</span> : null}
    </div>
  );
}

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
      ? `Tạm dừng · ${formatRemainingTime(liveEtaMs)}`
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
  const finishedTime = finishedMode && activeCampaign?.finishedAt
    ? dayjs(activeCampaign.finishedAt).format('HH:mm:ss')
    : null;
  const startedTime = !finishedMode && activeCampaign?.startedAt
    ? dayjs(activeCampaign.startedAt).format('HH:mm:ss')
    : null;

  return (
    <footer className="border-t border-border/60 bg-card/80 px-4 py-2 backdrop-blur">
      {/* Progress row */}
      <div className="mb-1.5 flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {total > 0 ? (
            <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-foreground/70">
              {roundedPercent}%
            </span>
          ) : null}
          <Progress value={percent} className="h-[3px] flex-1" />
          {total > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
              {processed}<span className="text-muted-foreground/40">/{total}</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/45">Chưa có chiến dịch</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showLastRunHint ? (
            <span className="text-[10px] text-muted-foreground/60">Lần chạy gần nhất</span>
          ) : null}
          <Badge
            variant={campaignStatusVariant}
            className="min-w-[68px] justify-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          >
            {campaignStatusLabel}
          </Badge>
        </div>
      </div>

      {/* Stats row — compact inline */}
      <div className="flex items-center gap-3.5 overflow-hidden">
        {/* Đã gửi */}
        <StatItem
          icon={<Send className="h-3 w-3" />}
          label="Đã gửi"
          value={
            dryRunCount > 0
              ? <><span className="text-success">{sentCount}</span><span className="ml-1 text-[9px] font-normal text-muted-foreground/50">{dryRunCount} thử</span></>
              : sentCount
          }
          valueClass={dryRunCount === 0 ? 'text-success' : undefined}
        />

        <StatDivider />

        {/* Lỗi / bỏ qua */}
        <StatItem
          icon={<AlertCircle className="h-3 w-3" />}
          label="Lỗi"
          value={failedCount}
          valueClass={hasError ? 'text-destructive' : undefined}
          sub={skippedCount > 0 ? `· ${skippedCount} bỏ qua` : undefined}
        />

        <StatDivider />

        {/* Thời gian */}
        <StatItem
          icon={<Clock className="h-3 w-3" />}
          label={finishedMode ? 'Thời lượng' : 'Còn lại'}
          value={finishedMode ? durationDisplay : etaDisplay}
        />

        <StatDivider />

        {/* Chiến dịch */}
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={campaignTitle}
        >
          <Tag className="h-3 w-3 shrink-0 text-muted-foreground/45" />
          <span className="truncate text-[11px] font-semibold text-foreground">{campaignDisplay}</span>
          {(finishedTime ?? startedTime) ? (
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/40">
              {finishedTime ? `· xong ${finishedTime}` : `· từ ${startedTime ?? ''}`}
            </span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
