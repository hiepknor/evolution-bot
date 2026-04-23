import dayjs from 'dayjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowDownUp, CheckCircle2, FileText, Info, Trash2, Search, X } from 'lucide-react';

import { panelTokens } from '@/components/layout/panel-tokens';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { CampaignLog } from '@/lib/types/domain';
import { useCampaignStore } from '@/stores/use-campaign-store';
import type { UiActivityLog } from '@/stores/use-activity-log-store';
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
  success: 'T.công',
  warn: 'C.báo',
  error: 'Lỗi'
};

const levelIcon: Record<string, JSX.Element> = {
  info: <Info className="h-3.5 w-3.5" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
  warn: <AlertTriangle className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5" />
};

const levelItemTone: Record<string, string> = {
  info: 'border-border/32 bg-background/22',
  success: 'border-success/24 bg-success/[0.045]',
  warn: 'border-warning/24 bg-warning/[0.05]',
  error: 'border-destructive/24 bg-destructive/[0.05]'
};

const levelBorderTone: Record<string, string> = {
  info: 'border-l-border/60',
  success: 'border-l-success/50',
  warn: 'border-l-warning/55',
  error: 'border-l-destructive/55'
};

interface ActivityLogPanelProps {
  onRequestClose?: () => void;
  className?: string;
  compact?: boolean;
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

export function ActivityLogPanel({ onRequestClose, className, compact = false }: ActivityLogPanelProps = {}): JSX.Element {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchInputComposing, setSearchInputComposing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{ uiLogs: UiActivityLog[]; campaignLogs: CampaignLog[] } | null>(null);
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
  const clearUndoTimerRef = useRef<number | null>(null);
  const logViewportRef = useRef<HTMLDivElement | null>(null);

  const running = useCampaignStore((state) => state.running);
  const paused = useCampaignStore((state) => state.paused);
  const queueProgress = useCampaignStore((state) => state.queueProgress);
  const activeCampaign = useCampaignStore((state) => state.activeCampaign);
  const campaignLogs = useCampaignStore((state) => state.logs);
  const clearCampaignLogs = useCampaignStore((state) => state.clearCampaignLogs);
  const replaceCampaignLogs = useCampaignStore((state) => state.replaceCampaignLogs);
  const uiLogs = useActivityLogStore((state) => state.uiLogs);
  const clearUiLogs = useActivityLogStore((state) => state.clearUiLogs);
  const replaceUiLogs = useActivityLogStore((state) => state.replaceUiLogs);

  const mergedLogs = useMemo(() => [...uiLogs, ...campaignLogs], [campaignLogs, uiLogs]);
  const orderedLogs = useMemo(
    () =>
      [...mergedLogs].sort((a, b) => {
        const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return sortOrder === 'newest' ? delta : -delta;
      }),
    [mergedLogs, sortOrder]
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
    return orderedLogs.filter((log) => {
      if (filter !== 'all' && log.level !== filter) {
        return false;
      }
      if (!term) {
        return true;
      }
      return localizeLogMessage(log.message).toLowerCase().includes(term);
    });
  }, [deferredSearchTerm, filter, orderedLogs]);

  const filterCounts = useMemo(() => {
    const counts: Record<LogFilter, number> = {
      all: mergedLogs.length,
      info: 0,
      success: 0,
      warn: 0,
      error: 0
    };

    mergedLogs.forEach((log) => {
      if (log.level === 'info') counts.info += 1;
      if (log.level === 'success') counts.success += 1;
      if (log.level === 'warn') counts.warn += 1;
      if (log.level === 'error') counts.error += 1;
    });

    return counts;
  }, [mergedLogs]);

  const isAlmostDone = Boolean(
    running &&
      !paused &&
      queueProgress &&
      queueProgress.total > 0 &&
      queueProgress.processed < queueProgress.total &&
      liveEtaMs <= 5000
  );

  const runningEtaLabel = paused
    ? `Tạm dừng • Còn lại: ${formatRemainingTime(liveEtaMs)}`
    : isAlmostDone
      ? 'Sắp hoàn tất...'
      : `Ước tính còn lại: ${formatRemainingTime(liveEtaMs)}`;

  const hasLogs = mergedLogs.length > 0;
  const compactLogLimit = compact ? 60 : Number.POSITIVE_INFINITY;
  const displayedLogs = useMemo(() => filteredLogs.slice(0, compactLogLimit), [compactLogLimit, filteredLogs]);
  const hiddenLogCount = Math.max(0, filteredLogs.length - displayedLogs.length);
  const virtualEnabled = !compact && displayedLogs.length > 120;
  const rowVirtualizer = useVirtualizer({
    count: displayedLogs.length,
    getScrollElement: () => logViewportRef.current,
    estimateSize: () => 78,
    overscan: 10,
    enabled: virtualEnabled,
    measureElement: (element) => element?.getBoundingClientRect().height ?? 0
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const onConfirmClearLogs = (): void => {
    if (!hasLogs) {
      setClearDialogOpen(false);
      return;
    }

    setUndoSnapshot({
      uiLogs: [...uiLogs],
      campaignLogs: [...campaignLogs]
    });
    clearUiLogs();
    clearCampaignLogs();
    setClearDialogOpen(false);

    if (clearUndoTimerRef.current) {
      window.clearTimeout(clearUndoTimerRef.current);
    }
    clearUndoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      clearUndoTimerRef.current = null;
    }, 8000);
  };

  const onUndoClearLogs = (): void => {
    if (!undoSnapshot) {
      return;
    }
    replaceUiLogs(undoSnapshot.uiLogs);
    replaceCampaignLogs(undoSnapshot.campaignLogs);
    setUndoSnapshot(null);
    if (clearUndoTimerRef.current) {
      window.clearTimeout(clearUndoTimerRef.current);
      clearUndoTimerRef.current = null;
    }
  };

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
    if (clearUndoTimerRef.current) {
      window.clearTimeout(clearUndoTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!logViewportRef.current) {
      return;
    }
    logViewportRef.current.scrollTo({ top: 0, behavior: 'auto' });
  }, [filter, sortOrder, deferredSearchTerm]);

  const renderLogItem = (log: CampaignLog | UiActivityLog): JSX.Element => (
    <article
      className={cn(
        'rounded-lg border border-l-2 px-2.5 py-2 text-[13px] transition-colors',
        levelItemTone[log.level] ?? levelItemTone.info,
        levelBorderTone[log.level] ?? levelBorderTone.info
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{levelIcon[log.level] ?? levelIcon.info}</span>
          {filter === 'all' ? (
            <Badge variant={levelVariant[log.level] ?? 'secondary'}>
              {levelLabel[log.level] ?? log.level}
            </Badge>
          ) : null}
          {'count' in log && typeof log.count === 'number' && log.count > 1 ? (
            <Badge variant="outline">x{log.count}</Badge>
          ) : null}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{dayjs(log.createdAt).format('HH:mm:ss')}</span>
      </div>
      <p className={cn('leading-[1.3rem] text-foreground/95', compact && 'truncate')}>
        {localizeLogMessage(log.message)}
      </p>
    </article>
  );

  return (
    <Card className={cn('flex h-full min-h-0 flex-col overflow-hidden border-border/60 bg-card', className)}>
      <CardHeader className={cn('border-b border-border/50 px-3 py-2.5', panelTokens.cardHeader)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <CardTitle>Nhật ký hoạt động</CardTitle>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-foreground/65">Tổng {mergedLogs.length} mục</span>
              <span className="text-border/60">·</span>
              <span className="text-xs text-foreground/65">
                Hiển thị {displayedLogs.length}
                {hiddenLogCount > 0 ? ` / ${filteredLogs.length}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {hasLogs ? (
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  '!h-8 gap-1.5 border-border/45 bg-background px-2.5 text-xs text-foreground/70 hover:border-destructive/35 hover:bg-destructive/10 hover:text-destructive',
                  panelTokens.control
                )}
                title="Xóa toàn bộ nhật ký"
                onClick={() => setClearDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa
              </Button>
            ) : null}
            {onRequestClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md border border-border/60"
                aria-label="Đóng nhật ký hoạt động"
                onClick={onRequestClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('flex min-h-0 flex-1 flex-col overflow-hidden p-2.5 pt-2.5', panelTokens.cardContent)}>
        {!compact && undoSnapshot ? (
          <div className="flex items-center justify-between rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
            <span>Đã xóa log. Bạn có thể hoàn tác trong vài giây.</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-warning/35 px-2.5 text-xs text-warning hover:bg-warning/15"
              onClick={onUndoClearLogs}
            >
              Hoàn tác
            </Button>
          </div>
        ) : null}

        {!compact && running && queueProgress ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2">
            <div className="mb-1 flex items-center justify-between">
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">Đang chạy</Badge>
              <span className="text-xs text-primary/90">{runningEtaLabel}</span>
            </div>
            <p className="text-[13px] leading-[1.25rem] text-foreground/90">
              {paused ? 'Đang tạm dừng' : 'Đang chạy'} {queueProgress.processed}/{queueProgress.total}
              {activeCampaign?.name ? ` • ${activeCampaign.name}` : ''}.
            </p>
          </div>
        ) : !compact && recentRunSnapshot ? (
          <div
            className={
              recentRunSnapshot.status === 'completed'
                ? 'rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-2'
                : recentRunSnapshot.status === 'failed'
                  ? 'rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-2'
                  : 'rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-2'
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
            <p className="text-[13px] leading-[1.25rem] text-foreground/90">
              Kết thúc {recentRunSnapshot.processed}/{recentRunSnapshot.total}
              {recentRunSnapshot.campaignName ? ` • ${recentRunSnapshot.campaignName}` : ''}.
            </p>
          </div>
        ) : null}

        <div className={cn(panelTokens.section, compact ? 'space-y-1.5 border-border/35 bg-card p-1.5' : 'space-y-2 border-border/35 bg-card p-2')}>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
              className={cn(
                '!h-9 rounded-md border-border/45 bg-background pl-9 pr-9 text-[13px] focus-visible:border-primary/45 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0',
                panelTokens.control
              )}
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
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Xóa từ khóa tìm log"
                aria-label="Xóa từ khóa tìm log"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-stretch gap-2">
            <div
              className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border/35 bg-background p-1"
              role="tablist"
              aria-label="Bộ lọc mức log"
            >
              <div className="flex min-w-max items-center gap-1">
                {(Object.keys(filterLabel) as LogFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    className={cn(
                      panelTokens.control,
                      'inline-flex h-8 min-w-[90px] shrink-0 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-medium tabular-nums transition-all',
                      filter === key
                        ? 'bg-card text-foreground ring-1 ring-border/45 shadow-sm'
                        : 'text-foreground/68 hover:text-foreground'
                    )}
                    onClick={() => setFilter(key)}
                  >
                    <span className="sm:hidden">{filterShortLabel[key]}</span>
                    <span className="hidden sm:inline">{filterLabel[key]}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                        filter === key ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'
                      )}
                    >
                      {filterCounts[key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                'shrink-0 border-border/35 bg-background px-3 text-[11px] font-medium text-foreground/80 hover:text-foreground',
                '!h-10 min-w-[112px] rounded-lg',
                panelTokens.control
              )}
              onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
              title={sortOrder === 'newest' ? 'Đang sắp xếp mới nhất trước' : 'Đang sắp xếp cũ nhất trước'}
            >
              <ArrowDownUp className="mr-1 h-3.5 w-3.5" />
              {sortOrder === 'newest' ? 'Mới nhất' : 'Cũ nhất'}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/35 bg-card">
          <div className="flex items-center justify-between border-b border-border/35 px-2.5 py-1.5 text-[11px] text-foreground/65">
            <span>
              {displayedLogs.length > 0
                ? `Đang hiển thị ${displayedLogs.length} mục`
                : hasLogs
                  ? 'Không có kết quả phù hợp'
                  : 'Danh sách trống'}
            </span>
            <span>{hiddenLogCount > 0 ? `+${hiddenLogCount} ẩn` : sortOrder === 'newest' ? 'Mới trước' : 'Cũ trước'}</span>
          </div>

          <div ref={logViewportRef} className="flex-1 overflow-auto p-2">
            {displayedLogs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-foreground/62">
                {hasLogs ? 'Không có log phù hợp bộ lọc hiện tại.' : 'Chưa có log nào.'}
              </div>
            ) : virtualEnabled ? (
              <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {virtualItems.map((item) => {
                  const log = displayedLogs[item.index];
                  if (!log) {
                    return null;
                  }

                  return (
                    <div
                      key={log.id}
                      data-index={item.index}
                      ref={rowVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full pb-2"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      {renderLogItem(log)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {displayedLogs.map((log) => (
                  <div key={log.id}>{renderLogItem(log)}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ nhật ký?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa cả nhật ký giao diện và nhật ký chiến dịch đang hiển thị. Bạn vẫn có thể hoàn tác trong vài giây ngay sau khi xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={onConfirmClearLogs}
            >
              Xóa toàn bộ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
