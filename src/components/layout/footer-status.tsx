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

  const percent = progress && progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  const roundedPercent = Number.isFinite(percent) ? Math.round(percent) : 0;
  const processed = progress?.processed ?? 0;
  const total = progress?.total ?? 0;
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

  const durationDisplay = finishedMode ? formatCampaignDuration(activeCampaign?.startedAt, activeCampaign?.finishedAt) : '-';
  const progressSummary = total > 0 ? `Tiến độ: ${roundedPercent}% (${processed}/${total})` : 'Chưa có chiến dịch đang theo dõi';
  const campaignName = activeCampaign?.name?.trim() || '';
  const campaignDisplay = campaignName || activeCampaign?.id || '-';
  const campaignTitle = activeCampaign ? `Tên: ${campaignName || '(chưa đặt)'}\nID: ${activeCampaign.id}` : '-';

  return (
    <footer className="space-y-3 border-t border-border/80 bg-card/70 px-4 py-3">
      <div className="rounded-lg border border-border/40 bg-background/35 px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/90">
          <div className="font-medium">{progressSummary}</div>
          <div className="flex items-center gap-2">
            {showLastRunHint ? <span className="text-xs text-muted-foreground">Kết quả lần chạy gần nhất</span> : null}
            <Badge variant={campaignStatusVariant} className="h-6 min-w-[92px] justify-center whitespace-nowrap rounded-full px-2">
              {campaignStatusLabel}
            </Badge>
          </div>
        </div>
        <Progress value={percent} />
      </div>

      <div className="grid grid-cols-1 gap-3 text-xs text-foreground/90 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border/40 bg-background/35 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Kết quả gửi</p>
          <p className="mt-1">Thật: {progress?.sent ?? 0} • Thử: {progress?.dryRunSuccess ?? 0}</p>
        </div>
        <div className="rounded-md border border-border/40 bg-background/35 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Lỗi và bỏ qua</p>
          <p className="mt-1">Lỗi: {progress?.failed ?? 0} • Bỏ qua: {progress?.skipped ?? 0}</p>
        </div>
        <div className="rounded-md border border-border/40 bg-background/35 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Thời gian</p>
          <p className="mt-1">{finishedMode ? `Thời lượng: ${durationDisplay}` : `Ước tính còn lại: ${etaDisplay}`}</p>
        </div>
        <div className="rounded-md border border-border/40 bg-background/35 px-3 py-2" title={campaignTitle}>
          <p className="text-[11px] text-muted-foreground">Chiến dịch hiện tại</p>
          <p className="mt-1 truncate">{campaignDisplay}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {finishedMode
              ? `Kết thúc: ${activeCampaign?.finishedAt ? dayjs(activeCampaign.finishedAt).format('HH:mm:ss') : '-'}`
              : `Bắt đầu: ${activeCampaign?.startedAt ? dayjs(activeCampaign.startedAt).format('HH:mm:ss') : '-'}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
