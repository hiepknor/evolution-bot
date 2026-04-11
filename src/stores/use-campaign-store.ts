import dayjs from 'dayjs';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { BroadcastQueue } from '@/lib/queue/broadcast-queue';
import { campaignPreferencesRepo, campaignsRepo, logsRepo, targetsRepo } from '@/lib/db/repositories';
import { buildCampaignChecksum } from '@/lib/utils/checksum';
import { campaignTargetsToCsv } from '@/lib/utils/csv';
import { createProvider } from '@/lib/providers/provider-factory';
import { toAppError } from '@/lib/utils/error';
import type {
  Campaign,
  CampaignConfig,
  CampaignLog,
  CampaignTarget,
  ComposerState,
  ConnectionSettings,
  Group,
  QueueProgress,
  TargetStatus
} from '@/lib/types/domain';

const defaultConfig: CampaignConfig = {
  randomDelayMinMs: 2000,
  randomDelayMaxMs: 6000,
  pauseEvery: 0,
  pauseDurationMs: 15_000,
  maxAttempts: 2,
  blacklist: [],
  whitelistMode: false,
  warningThreshold: 50
};

const deriveDryRunSuccessCount = (campaign: Pick<Campaign, 'dryRun' | 'totalTargets' | 'sentCount' | 'failedCount' | 'skippedCount'>): number => {
  if (!campaign.dryRun) {
    return 0;
  }

  const inferredFromTotals = Math.max(
    0,
    campaign.totalTargets - campaign.failedCount - campaign.skippedCount
  );
  return Math.max(campaign.sentCount, inferredFromTotals);
};

const campaignToProgress = (campaign: Campaign): QueueProgress => {
  const dryRunSuccess = deriveDryRunSuccessCount(campaign);
  const sent = campaign.dryRun ? 0 : campaign.sentCount;
  const processed = Math.min(
    campaign.totalTargets,
    sent + dryRunSuccess + campaign.failedCount + campaign.skippedCount
  );

  return {
    campaignId: campaign.id,
    total: campaign.totalTargets,
    processed,
    sent,
    dryRunSuccess,
    failed: campaign.failedCount,
    skipped: campaign.skippedCount,
    etaMs: 0
  };
};

const transientTargetStatuses = new Set<TargetStatus>(['pending', 'running']);

const toNonNegativeInt = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
};

const toMinInt = (value: unknown, fallback: number, min: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.floor(value));
};

const toStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const normalizeChatId = (chatId: string): string => chatId.trim().toLowerCase();

const normalizeChatIdList = (chatIds: string[]): string[] =>
  Array.from(
    new Set(
      chatIds
        .map((chatId) => normalizeChatId(chatId))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

const sanitizeCampaignConfig = (
  input: Partial<CampaignConfig> | null | undefined,
  fallback: CampaignConfig
): CampaignConfig => {
  const source = input ?? {};
  const randomDelayMinMs = toNonNegativeInt(source.randomDelayMinMs, fallback.randomDelayMinMs);
  const randomDelayMaxRaw = toNonNegativeInt(source.randomDelayMaxMs, fallback.randomDelayMaxMs);
  const randomDelayMaxMs = Math.max(randomDelayMaxRaw, randomDelayMinMs);

  return {
    randomDelayMinMs,
    randomDelayMaxMs,
    pauseEvery: toNonNegativeInt(source.pauseEvery, fallback.pauseEvery),
    pauseDurationMs: toNonNegativeInt(source.pauseDurationMs, fallback.pauseDurationMs),
    maxAttempts: toMinInt(source.maxAttempts, fallback.maxAttempts, 1),
    blacklist: normalizeChatIdList(toStringArray(source.blacklist, fallback.blacklist)),
    whitelistMode:
      typeof source.whitelistMode === 'boolean' ? source.whitelistMode : fallback.whitelistMode,
    warningThreshold: toNonNegativeInt(source.warningThreshold, fallback.warningThreshold)
  };
};

interface CampaignStore {
  activeCampaign?: Campaign;
  queueProgress?: QueueProgress;
  logs: CampaignLog[];
  targets: CampaignTarget[];
  history: Campaign[];
  historyLoading: boolean;
  historyError: string | null;
  running: boolean;
  paused: boolean;
  stopping: boolean;
  queueSessionId: number;
  duplicateWarning: string | null;
  queue?: BroadcastQueue;
  config: CampaignConfig;
  loadConfig: () => Promise<void>;
  loadHistory: () => Promise<void>;
  restoreLatestCampaign: () => Promise<void>;
  previewDuplicateWarning: (input: {
    groups: Group[];
    selectedIds: string[];
    composer: ComposerState;
  }) => Promise<{ warning: string | null }>;
  setConfig: (config: Partial<CampaignConfig>) => void;
  startCampaign: (input: {
    settings: ConnectionSettings;
    groups: Group[];
    selectedIds: string[];
    composer: ComposerState;
    dryRun: boolean;
    name: string;
  }) => Promise<void>;
  pauseCampaign: () => Promise<void>;
  resumeCampaign: () => Promise<void>;
  stopCampaign: () => void;
  exportLatestCsv: () => Promise<void>;
  exportCampaignCsv: (campaignId: string) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  clearCampaignLogs: () => void;
  openCampaign: (campaignId: string) => Promise<void>;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  activeCampaign: undefined,
  queueProgress: undefined,
  logs: [],
  targets: [],
  history: [],
  historyLoading: false,
  historyError: null,
  running: false,
  paused: false,
  stopping: false,
  queueSessionId: 0,
  duplicateWarning: null,
  queue: undefined,
  config: defaultConfig,

  loadConfig: async () => {
    try {
      const persistedConfig = await campaignPreferencesRepo.get();
      if (!persistedConfig) {
        return;
      }
      set({ config: sanitizeCampaignConfig(persistedConfig, defaultConfig) });
    } catch (error) {
      console.error('Failed to load campaign preferences', error);
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const history = await campaignsRepo.list(30);
      set({ history, historyLoading: false, historyError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử chiến dịch';
      set({ historyLoading: false, historyError: message });
    }
  },
  restoreLatestCampaign: async () => {
    const history = get().history.length > 0 ? get().history : await campaignsRepo.list(30);
    const latestCampaign = history[0];

    if (!latestCampaign) {
      set({
        history,
        activeCampaign: undefined,
        targets: [],
        logs: [],
        queueProgress: get().running ? get().queueProgress : undefined,
        paused: get().running ? get().paused : false,
        stopping: get().running ? get().stopping : false
      });
      return;
    }

    const [targets, logs] = await Promise.all([
      targetsRepo.byCampaign(latestCampaign.id),
      logsRepo.byCampaign(latestCampaign.id)
    ]);

    set((state) => ({
      history,
      activeCampaign: latestCampaign,
      targets,
      logs,
      queueProgress: state.running ? state.queueProgress : campaignToProgress(latestCampaign),
      paused: state.running ? state.paused : false,
      stopping: state.running ? state.stopping : false
    }));
  },

  previewDuplicateWarning: async ({ groups, selectedIds, composer }) => {
    const selectedGroups = groups.filter((group) => selectedIds.includes(group.chatId));
    const configuredSet = new Set(get().config.blacklist.map((chatId) => normalizeChatId(chatId)));
    const allowedGroups = get().config.whitelistMode
      ? selectedGroups.filter((group) => configuredSet.has(normalizeChatId(group.chatId)))
      : selectedGroups.filter((group) => !configuredSet.has(normalizeChatId(group.chatId)));

    if (allowedGroups.length === 0) {
      set({ duplicateWarning: null });
      return { warning: null };
    }

    const checksum = buildCampaignChecksum({
      imagePath: composer.imagePath,
      captionTemplate: composer.captionTemplate,
      introText: composer.introText,
      titleText: composer.titleText,
      footerText: composer.footerText,
      plainTextFallback: composer.plainTextFallback,
      targetIds: allowedGroups.map((group) => group.chatId)
    });

    const latestCampaign = (await campaignsRepo.list(1))[0];
    const isDuplicate = Boolean(latestCampaign && latestCampaign.checksum === checksum);
    const warning = isDuplicate
      ? 'Nội dung gửi trùng với lần chạy gần nhất. Hệ thống vẫn tạo lần chạy mới để giữ lịch sử.'
      : null;
    set({ duplicateWarning: warning });
    return { warning };
  },

  setConfig: (config) => {
    const nextConfig = sanitizeCampaignConfig(
      { ...get().config, ...config },
      defaultConfig
    );
    set({ config: nextConfig });
    void campaignPreferencesRepo.upsert(nextConfig).catch((error) => {
      console.error('Failed to save campaign preferences', error);
    });
  },

  startCampaign: async ({ settings, groups, selectedIds, composer, dryRun, name }) => {
    if (get().running || get().stopping || get().queue) {
      throw new Error('Chiến dịch hiện tại đang chạy hoặc đang dừng. Vui lòng chờ hoàn tất.');
    }

    if (!settings.baseUrl || !settings.apiKey || !settings.instanceName) {
      throw new Error('Cấu hình kết nối chưa đầy đủ');
    }

    if (selectedIds.length === 0) {
      throw new Error('Chưa chọn nhóm nhận');
    }

    if (!composer.imagePath && !composer.plainTextFallback.trim() && !composer.captionTemplate.trim()) {
      throw new Error('Cần có ảnh hoặc nội dung văn bản');
    }

    const campaignName = name.trim();
    if (!campaignName) {
      throw new Error('Tên chiến dịch không được để trống');
    }

    const selectedGroups = groups.filter((group) => selectedIds.includes(group.chatId));
    if (selectedGroups.length === 0) {
      throw new Error('Nhóm đã chọn không còn hợp lệ. Vui lòng đồng bộ lại danh sách nhóm.');
    }

    const configuredSet = new Set(get().config.blacklist.map((chatId) => normalizeChatId(chatId)));
    const allowedGroups = get().config.whitelistMode
      ? selectedGroups.filter((group) => configuredSet.has(normalizeChatId(group.chatId)))
      : selectedGroups.filter((group) => !configuredSet.has(normalizeChatId(group.chatId)));

    if (allowedGroups.length === 0) {
      throw new Error('Không có nhóm hợp lệ để gửi sau khi áp dụng bộ lọc danh sách');
    }

    const checksum = buildCampaignChecksum({
      imagePath: composer.imagePath,
      captionTemplate: composer.captionTemplate,
      introText: composer.introText,
      titleText: composer.titleText,
      footerText: composer.footerText,
      plainTextFallback: composer.plainTextFallback,
      targetIds: allowedGroups.map((group) => group.chatId)
    });

    const latestCampaign = (await campaignsRepo.list(1))[0];
    const isDuplicateLatest = Boolean(latestCampaign && latestCampaign.checksum === checksum);
    set({
      duplicateWarning: isDuplicateLatest
        ? 'Nội dung gửi trùng với lần chạy gần nhất. Hệ thống vẫn tạo lần chạy mới để giữ lịch sử.'
        : null
    });

    const campaign: Campaign = {
      id: uuidv4(),
      name: campaignName,
      imagePath: composer.imagePath,
      captionTemplate: composer.captionTemplate,
      introText: composer.introText,
      titleText: composer.titleText,
      footerText: composer.footerText,
      plainTextFallback: composer.plainTextFallback,
      emojiMode: composer.emojiMode,
      dryRun,
      status: 'running',
      totalTargets: allowedGroups.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      startedAt: dayjs().toISOString(),
      config: get().config,
      checksum
    };

    const provider = createProvider({
      mode: settings.providerMode,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey
    });

    const queueSessionId = get().queueSessionId + 1;
    const isCurrentSession = (): boolean => get().queueSessionId === queueSessionId;

    await campaignsRepo.insert(campaign);
    set({
      activeCampaign: campaign,
      logs: [],
      targets: [],
      queueProgress: {
        campaignId: campaign.id,
        total: campaign.totalTargets,
        processed: 0,
        sent: 0,
        dryRunSuccess: 0,
        failed: 0,
        skipped: 0,
        etaMs: 0
      },
      running: true,
      paused: false,
      stopping: false,
      queueSessionId
    });

    const queue = new BroadcastQueue({
      provider,
      instanceName: settings.instanceName,
      campaign,
      groups: allowedGroups,
      callbacks: {
        onProgress: (queueProgress) => {
          if (!isCurrentSession()) {
            return;
          }
          set({ queueProgress });
        },
        onLog: async (entry) => {
          const log = await logsRepo.insert(entry);
          if (!isCurrentSession()) {
            return;
          }
          set((state) => ({ logs: [...state.logs, log] }));
        },
        onTargetUpdate: async (target) => {
          if (isCurrentSession()) {
            set((state) => {
              const exists = state.targets.some((item) => item.id === target.id);
              return {
                targets: exists
                  ? state.targets.map((item) => (item.id === target.id ? target : item))
                  : [...state.targets, target]
              };
            });
          }

          if (transientTargetStatuses.has(target.status)) {
            return;
          }

          await targetsRepo.upsert(target);
        },
        onFinish: async (summary) => {
          const state = get();
          const finishedAt = dayjs().toISOString();
          const stopped = state.stopping;
          const finalStatus: Campaign['status'] = stopped ? 'stopped' : 'completed';
          await campaignsRepo.updateStatus(campaign.id, finalStatus, {
            sentCount: summary.sent,
            failedCount: summary.failed,
            skippedCount: summary.skipped,
            finishedAt
          });
          if (!isCurrentSession()) {
            return;
          }
          set((state) => ({
            running: false,
            paused: false,
            stopping: false,
            activeCampaign: state.activeCampaign
              ? {
                  ...state.activeCampaign,
                  status: finalStatus,
                  sentCount: summary.sent,
                  failedCount: summary.failed,
                  skippedCount: summary.skipped,
                  finishedAt
                }
              : undefined,
            queue: undefined
          }));
        }
      }
    });

    set({ queue });
    try {
      await queue.run();
      await get().loadHistory();
      await get().openCampaign(campaign.id);
    } catch (error) {
      const appError = toAppError(error, 'CAMPAIGN_RUN_FAILED');
      const finishedAt = dayjs().toISOString();
      const message = appError.status
        ? `${appError.message} (HTTP ${appError.status})`
        : appError.message;

      await logsRepo.insert({
        campaignId: campaign.id,
        level: 'error',
        message: `Chiến dịch thất bại: ${message}`,
        meta: { code: appError.code, details: appError.details }
      });

      await campaignsRepo.updateStatus(campaign.id, 'failed', {
        sentCount: get().queueProgress?.sent ?? 0,
        failedCount: get().queueProgress?.failed ?? 0,
        skippedCount: get().queueProgress?.skipped ?? 0,
        finishedAt
      });

      set((state) => ({
        running: false,
        paused: false,
        stopping: false,
        queue: undefined,
        activeCampaign: state.activeCampaign
          ? { ...state.activeCampaign, status: 'failed', finishedAt }
          : undefined
      }));

      await get().loadHistory();
      await get().openCampaign(campaign.id);
      throw appError;
    }
  },

  pauseCampaign: async () => {
    const queue = get().queue;
    const activeCampaign = get().activeCampaign;
    if (!queue || !activeCampaign || !get().running || get().paused) {
      return;
    }

    queue.pause();
    set({ paused: true });

    try {
      const log = await logsRepo.insert({
        campaignId: activeCampaign.id,
        level: 'info',
        message: 'Đã tạm dừng chiến dịch'
      });
      set((state) => ({ logs: [...state.logs, log] }));
    } catch {
      // Ignore logging failures to avoid breaking pause control.
    }
  },

  resumeCampaign: async () => {
    const queue = get().queue;
    const activeCampaign = get().activeCampaign;
    if (!queue || !activeCampaign || !get().running || !get().paused) {
      return;
    }

    queue.resume();
    set({ paused: false });

    try {
      const log = await logsRepo.insert({
        campaignId: activeCampaign.id,
        level: 'info',
        message: 'Tiếp tục chiến dịch'
      });
      set((state) => ({ logs: [...state.logs, log] }));
    } catch {
      // Ignore logging failures to avoid breaking resume control.
    }
  },

  stopCampaign: () => {
    const queue = get().queue;
    const activeCampaign = get().activeCampaign;
    if (!queue || !activeCampaign || !get().running) {
      return;
    }
    if (get().stopping) {
      return;
    }
    queue.stop();

    set({
      paused: false,
      stopping: true
    });
  },

  exportLatestCsv: async () => {
    const campaign = get().activeCampaign;
    if (!campaign) {
      return;
    }
    const targets = await targetsRepo.byCampaign(campaign.id);
    const csv = campaignTargetsToCsv(campaign, targets);
    const path = await save({
      defaultPath: `campaign-${campaign.id}.csv`,
      filters: [
        {
          name: 'CSV',
          extensions: ['csv']
        }
      ]
    });

    if (path) {
      await writeTextFile(path, csv);
    }
  },

  exportCampaignCsv: async (campaignId) => {
    const campaign =
      get().history.find((item) => item.id === campaignId) ??
      (get().activeCampaign?.id === campaignId ? get().activeCampaign : undefined);
    if (!campaign) {
      return;
    }

    const targets = await targetsRepo.byCampaign(campaign.id);
    const csv = campaignTargetsToCsv(campaign, targets);
    const path = await save({
      defaultPath: `campaign-${campaign.id}.csv`,
      filters: [
        {
          name: 'CSV',
          extensions: ['csv']
        }
      ]
    });

    if (path) {
      await writeTextFile(path, csv);
    }
  },

  deleteCampaign: async (campaignId) => {
    const campaign =
      get().history.find((item) => item.id === campaignId) ??
      (get().activeCampaign?.id === campaignId ? get().activeCampaign : undefined);
    if (!campaign) {
      return;
    }

    const isCurrentlyRunning =
      get().running && get().activeCampaign?.id === campaignId && campaign.status === 'running';
    if (isCurrentlyRunning || campaign.status === 'running') {
      throw new Error('Không thể xóa chiến dịch đang chạy');
    }

    await campaignsRepo.remove(campaignId);

    set((state) => ({
      history: state.history.filter((item) => item.id !== campaignId),
      activeCampaign: state.activeCampaign?.id === campaignId ? undefined : state.activeCampaign,
      logs: state.activeCampaign?.id === campaignId ? [] : state.logs,
      targets: state.activeCampaign?.id === campaignId ? [] : state.targets,
      queueProgress: state.activeCampaign?.id === campaignId ? undefined : state.queueProgress
    }));
  },

  clearCampaignLogs: () => {
    set({ logs: [] });
  },

  openCampaign: async (campaignId) => {
    const campaign = get().history.find((item) => item.id === campaignId);
    if (!campaign) {
      return;
    }

    const [targets, logs] = await Promise.all([
      targetsRepo.byCampaign(campaignId),
      logsRepo.byCampaign(campaignId)
    ]);

    set((state) => ({
      activeCampaign: campaign,
      targets,
      logs,
      queueProgress: state.running ? state.queueProgress : campaignToProgress(campaign),
      paused: state.running ? state.paused : false,
      stopping: state.running ? state.stopping : false
    }));
  }
}));
