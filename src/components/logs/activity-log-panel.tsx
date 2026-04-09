import dayjs from 'dayjs';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { panelTokens } from '@/components/layout/panel-tokens';
import { cn } from '@/lib/utils/cn';
import { useCampaignStore } from '@/stores/use-campaign-store';
import { useActivityLogStore } from '@/stores/use-activity-log-store';

const levelVariant: Record<string, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  info: 'secondary',
  success: 'success',
  warn: 'warning',
  error: 'destructive'
};

const levelLabel: Record<string, string> = {
  info: 'Thông tin',
  success: 'Thành công',
  warn: 'Cảnh báo',
  error: 'Lỗi'
};

type LogFilter = 'all' | 'info' | 'success' | 'warn' | 'error';
type RecentRunStatus = 'completed' | 'failed' | 'stopped';

const filterLabel: Record<LogFilter, string> = {
  all: 'Tất cả',
  info: 'Thông tin',
  success: 'Thành công',
  warn: 'Cảnh báo',
  error: 'Lỗi'
};

const filterShortLabel: Record<LogFilter, string> = {
  all: 'Tất cả',
  info: 'Tin',
  success: 'OK',
  warn: 'C.báo',
  error: 'Lỗi'
};

interface ActivityLogPanelProps {
  onRequestClose?: () => void;
  className?: string;
}

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

const localizeLogMessage = (raw: string): string => {
  const delivered = raw.match(/^Delivered to (.+)$/i);
  if (delivered) {
    return `Đã gửi tới ${delivered[1]}`;
  }

  const failed = raw.match(/^Failed for (.+)$/i);
  if (failed) {
    return `Gửi thất bại tới ${failed[1]}`;
  }

  const started = raw.match(/^Campaign started with (\d+) targets$/i);
  if (started) {
    return `Bắt đầu chiến dịch với ${started[1]} nhóm nhận`;
  }

  const finished = raw.match(/^Campaign finished in (\d+)s$/i);
  if (finished) {
    return `Chiến dịch hoàn tất sau ${finished[1]} giây`;
  }

  const retried = raw.match(/^Retry (\d+)\/(\d+) for (.+)$/i);
  if (retried) {
    return `Thử lại ${retried[1]}/${retried[2]} cho ${retried[3]}`;
  }

  const skipped = raw.match(/^Skipped (.+)$/i);
  if (skipped) {
    return `Bỏ qua ${skipped[1]}`;
  }

  if (/^Connection established$/i.test(raw)) {
    return 'Kết nối thành công';
  }
  if (/^Connection failed$/i.test(raw)) {
    return 'Kết nối thất bại';
  }

  return raw;
};

export function ActivityLogPanel({ onRequestClose, className }: ActivityLogPanelProps = {}): JSX.Element {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchInputComposing, setSearchInputComposing] = useState(false);
  const [liveEtaMs, setLiveEtaMs] = useState<number>(0);
  const [recentRunSnapshot, setRecentRunSnapshot] = useState<{
    status: RecentRunStatus;
    processed: number;
    total: number;
    campaignName?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const etaAnchorRef = useRef<{ baseMs: number; startedAtMs: number } | null>(null);
  const prevRunningRef = useRef<boolean>(false);
  const clearSnapshotTimerRef = useRef<number | null>(null);
  const running = useCampaignStore((state) => state.running);
  const paused = useCampaignStore((state) => state.paused);
  const queueProgress = useCampaignStore((state) => state.queueProgress);
  const activeCampaign = useCampaignStore((state) => state.activeCampaign);
  const campaignLogs = useCampaignStore((state) => state.logs);
  const clearCampaignLogs = useCampaignStore((state) => state.clearCampaignLogs);
  const uiLogs = useActivityLogStore((state) => state.uiLogs);
  const clearUiLogs = useActivityLogStore((state) => state.clearUiLogs);
  const logs = useMemo(
    () =>
      [...uiLogs, ...campaignLogs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [campaignLogs, uiLogs]
  );
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    if (searchInputComposing) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (searchTerm !== searchInputValue) {
        setSearchTerm(searchInputValue);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchInputComposing, searchInputValue, searchTerm]);

  const filteredLogs = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      if (filter !== 'all' && log.level !== filter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return localizeLogMessage(log.message).toLowerCase().includes(term);
    });
  }, [deferredSearchTerm, filter, logs]);
  const filterCounts = useMemo(() => {
    const counts: Record<LogFilter, number> = {
      all: logs.length,
      info: 0,
      success: 0,
      warn: 0,
      error: 0
    };

    logs.forEach((log) => {
      if (log.level === 'info') counts.info += 1;
      if (log.level === 'success') counts.success += 1;
      if (log.level === 'warn') counts.warn += 1;
      if (log.level === 'error') counts.error += 1;
    });

    return counts;
  }, [logs]);
  const isAlmostDone = Boolean(
    running &&
    !paused &&
    queueProgress &&
    queueProgress.total > 0 &&
    queueProgress.processed < queueProgress.total &&
    liveEtaMs <= 5000
  );
  const runningEtaLabel = paused
    ? `Tạm dừng • ETA còn lại: ${formatRemainingTime(liveEtaMs)}`
    : isAlmostDone
      ? 'Sắp hoàn tất...'
      : `ETA (ước tính): ${formatRemainingTime(liveEtaMs)}`;

  useEffect(() => {
    const wasRunning = prevRunningRef.current;

    if (running) {
      if (clearSnapshotTimerRef.current) {
        window.clearTimeout(clearSnapshotTimerRef.current);
        clearSnapshotTimerRef.current = null;
      }
      setRecentRunSnapshot(null);
      prevRunningRef.current = true;
      return;
    }

    if (wasRunning) {
      const status = activeCampaign?.status;
      if (status === 'completed' || status === 'failed' || status === 'stopped') {
        const processed = queueProgress?.processed ?? activeCampaign?.totalTargets ?? 0;
        const total = queueProgress?.total ?? activeCampaign?.totalTargets ?? processed;
        setRecentRunSnapshot({
          status,
          processed,
          total,
          campaignName: activeCampaign?.name
        });
        if (clearSnapshotTimerRef.current) {
          window.clearTimeout(clearSnapshotTimerRef.current);
        }
        clearSnapshotTimerRef.current = window.setTimeout(() => {
          setRecentRunSnapshot(null);
          clearSnapshotTimerRef.current = null;
        }, 5000);
      }
    }

    prevRunningRef.current = false;
  }, [
    running,
    activeCampaign?.status,
    activeCampaign?.name,
    activeCampaign?.totalTargets,
    queueProgress?.processed,
    queueProgress?.total
  ]);

  useEffect(() => {
    if (!running || !queueProgress) {
      etaAnchorRef.current = null;
      setLiveEtaMs(0);
      return;
    }

    if (paused) {
      etaAnchorRef.current = null;
      setLiveEtaMs(Math.max(0, queueProgress.etaMs));
      return;
    }

    const baseMs = Math.max(0, queueProgress.etaMs);
    etaAnchorRef.current = { baseMs, startedAtMs: Date.now() };
    setLiveEtaMs(baseMs);
  }, [
    paused,
    running,
    queueProgress,
    queueProgress?.campaignId,
    queueProgress?.processed,
    queueProgress?.total,
    queueProgress?.etaMs
  ]);

  useEffect(() => {
    if (!running || paused) {
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
  }, [paused, running]);

  useEffect(() => () => {
    if (clearSnapshotTimerRef.current) {
      window.clearTimeout(clearSnapshotTimerRef.current);
    }
  }, []);

  return (
    <Card className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <CardHeader className={cn('flex flex-row items-start justify-between gap-2', panelTokens.cardHeader)}>
        <CardTitle>Nhật ký hoạt động</CardTitle>
        {onRequestClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Đóng nhật ký hoạt động"
            onClick={onRequestClose}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', panelTokens.cardContent)}>
        {running && queueProgress ? (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
            <div className="mb-1 flex items-center justify-between">
              <Badge variant="secondary">Thông tin</Badge>
              <span className="text-xs text-primary">{runningEtaLabel}</span>
            </div>
            <p className="text-sm leading-5 text-foreground/90">
              {paused ? 'Đang tạm dừng' : 'Đang chạy'} {queueProgress.processed}/{queueProgress.total}
              {activeCampaign?.name ? ` • ${activeCampaign.name}` : ''}.
            </p>
          </div>
        ) : recentRunSnapshot ? (
          <div
            className={
              recentRunSnapshot.status === 'completed'
                ? 'rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3'
                : recentRunSnapshot.status === 'failed'
                  ? 'rounded-md border border-destructive/40 bg-destructive/10 p-3'
                  : 'rounded-md border border-warning/40 bg-warning/10 p-3'
            }
          >
            <div className="mb-1 flex items-center justify-between">
              <Badge
                variant={
                  recentRunSnapshot.status === 'completed'
                    ? 'success'
                    : recentRunSnapshot.status === 'failed'
                      ? 'destructive'
                      : 'warning'
                }
              >
                {recentRunSnapshot.status === 'completed'
                  ? 'Hoàn tất'
                  : recentRunSnapshot.status === 'failed'
                    ? 'Thất bại'
                    : 'Đã dừng'}
              </Badge>
              <span className="text-xs text-muted-foreground">vừa xong</span>
            </div>
            <p className="text-sm leading-5 text-foreground/90">
              Kết thúc {recentRunSnapshot.processed}/{recentRunSnapshot.total}
              {recentRunSnapshot.campaignName ? ` • ${recentRunSnapshot.campaignName}` : ''}.
            </p>
          </div>
        ) : null}
        <div className={panelTokens.section}>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchInputValue}
              onChange={(event) => setSearchInputValue(event.target.value)}
              onCompositionStart={() => setSearchInputComposing(true)}
              onCompositionEnd={(event) => {
                const nextValue = event.currentTarget.value;
                setSearchInputComposing(false);
                setSearchInputValue(nextValue);
                setSearchTerm(nextValue);
              }}
              className={cn('rounded-md border-border/70 bg-background/40 pl-9 pr-9', panelTokens.control)}
              placeholder="Tìm theo nội dung log"
            />
            {searchInputValue.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInputValue('');
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Xóa từ khóa tìm log"
                aria-label="Xóa từ khóa tìm log"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border/70 bg-background/35 p-0.5"
              role="tablist"
              aria-label="Bộ lọc mức log"
            >
              <div className="flex min-w-max items-center gap-0.5">
                {(Object.keys(filterLabel) as LogFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    aria-pressed={filter === key}
                    className={`inline-flex h-9 min-w-[112px] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-0 text-sm font-medium leading-none tabular-nums transition-colors ${
                      filter === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/85 hover:bg-muted/50'
                    }`}
                    onClick={() => setFilter(key)}
                  >
                    <span className="sm:hidden">{`${filterShortLabel[key]} (${filterCounts[key]})`}</span>
                    <span className="hidden sm:inline">{`${filterLabel[key]} (${filterCounts[key]})`}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button
              size="icon"
              variant="outline"
              className={cn('w-9 shrink-0 rounded-md', panelTokens.control)}
              title="Xóa toàn bộ nhật ký"
              onClick={() => {
                clearUiLogs();
                clearCampaignLogs();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-auto rounded-md border border-border/55 bg-muted/10 p-3">
          {filteredLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {logs.length > 0 ? 'Không có log phù hợp bộ lọc hiện tại.' : 'Chưa có log nào.'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="rounded-md bg-card/30 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {filter === 'all' ? (
                      <Badge variant={levelVariant[log.level] ?? 'secondary'}>
                        {levelLabel[log.level] ?? log.level}
                      </Badge>
                    ) : null}
                    {'count' in log && typeof log.count === 'number' && log.count > 1 ? (
                      <Badge variant="outline">x{log.count}</Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{dayjs(log.createdAt).format('HH:mm:ss')}</span>
                </div>
                <p className="leading-5 text-foreground/95">{localizeLogMessage(log.message)}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
