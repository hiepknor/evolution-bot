import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

  const percent = progress && progress.total > 0
    ? (progress.processed / progress.total) * 100
    : 0;
  const roundedPercent = Number.isFinite(percent) ? Math.round(percent) : 0;
  const processed = progress?.processed ?? 0;
  const total = progress?.total ?? 0;
  const campaignStatus = activeCampaign?.status ?? 'draft';
  const liveMode = running || stopping;
  const finishedMode =
    !liveMode && (campaignStatus === 'completed' || campaignStatus === 'failed' || campaignStatus === 'stopped');
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
  const progressSummary = total > 0
    ? `Tiến độ: ${roundedPercent}% (${processed}/${total})`
    : 'Chưa có chiến dịch đang theo dõi';
  const campaignName = activeCampaign?.name?.trim() || '';
  const campaignDisplay = campaignName || activeCampaign?.id || '-';
  const campaignTitle = activeCampaign
    ? `Tên: ${campaignName || '(chưa đặt)'}\nID: ${activeCampaign.id}`
    : '-';

  return (
    <footer className="space-y-3 border-t border-border/80 bg-card/70 px-4 py-3">
      <Progress value={percent} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>{progressSummary}</div>
        <div className="flex items-center gap-2">
          {showLastRunHint ? <span>Kết quả lần chạy gần nhất</span> : null}
          <Badge
            variant={campaignStatusVariant}
            className="h-6 min-w-[84px] justify-center whitespace-nowrap rounded-full px-2"
          >
            {campaignStatusLabel}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs text-foreground/90 sm:grid-cols-2 lg:grid-cols-6">
        <div>Đã gửi: {progress?.sent ?? 0}</div>
        <div>Lỗi: {progress?.failed ?? 0}</div>
        <div>Bỏ qua: {progress?.skipped ?? 0}</div>
        <div>{finishedMode ? `Thời lượng: ${durationDisplay}` : `ETA (ước tính): ${etaDisplay}`}</div>
        <div className="truncate" title={campaignTitle}>
          Chiến dịch: {campaignDisplay}
        </div>
        <div className="text-left sm:text-right">
          {finishedMode
            ? `Kết thúc: ${activeCampaign?.finishedAt ? dayjs(activeCampaign.finishedAt).format('HH:mm:ss') : '-'}`
            : `Bắt đầu: ${activeCampaign?.startedAt ? dayjs(activeCampaign.startedAt).format('HH:mm:ss') : '-'}`}
        </div>
      </div>
    </footer>
  );
}
