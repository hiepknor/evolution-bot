export type ConnectionBadgeState = 'connected' | 'disconnected' | 'checking';

export type EmojiMode = 'none' | 'low' | 'medium' | 'high';

export type CampaignStatus = 'draft' | 'running' | 'completed' | 'stopped' | 'failed';

export type TargetStatus =
  | 'pending'
  | 'running'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'dry-run-success'
  | 'cancelled';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface ConnectionSettings {
  id: string;
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  providerMode: 'evolution' | 'mock';
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  chatId: string;
  name: string;
  membersCount: number;
  sendable: boolean;
  adminOnly: boolean;
  raw: Record<string, unknown>;
  syncedAt: string;
}

export interface CampaignConfig {
  randomDelayMinMs: number;
  randomDelayMaxMs: number;
  pauseEvery: number;
  pauseDurationMs: number;
  maxAttempts: number;
  blacklist: string[];
  whitelistMode: boolean;
  warningThreshold: number;
}

export interface ComposerState {
  imagePath?: string;
  imageName?: string;
  captionTemplate: string;
  introText: string;
  titleText: string;
  footerText: string;
  plainTextFallback: string;
  emojiMode: EmojiMode;
  recentFiles: string[];
}

export interface Campaign {
  id: string;
  name: string;
  imagePath?: string;
  captionTemplate: string;
  introText: string;
  titleText: string;
  footerText: string;
  plainTextFallback: string;
  emojiMode: EmojiMode;
  dryRun: boolean;
  status: CampaignStatus;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: string;
  finishedAt?: string;
  config: CampaignConfig;
  checksum: string;
}

export interface CampaignTarget {
  id: string;
  campaignId: string;
  chatId: string;
  groupName: string;
  membersCount: number;
  renderedCaption: string;
  status: TargetStatus;
  attempts: number;
  lastError?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface CampaignLog {
  id: string;
  campaignId: string;
  targetId?: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConnectionState {
  isConnected: boolean;
  instanceName: string;
  state: string;
  raw?: Record<string, unknown>;
}

export interface SendPayload {
  imagePath?: string;
  caption: string;
  plainText?: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  statusCode?: number;
  error?: string;
  raw?: Record<string, unknown>;
}

export interface QueueProgress {
  campaignId: string;
  total: number;
  processed: number;
  sent: number;
  dryRunSuccess: number;
  failed: number;
  skipped: number;
  etaMs: number;
  currentTarget?: CampaignTarget;
}

export interface QueueCallbacks {
  onProgress?: (progress: QueueProgress) => void | Promise<void>;
  onLog?: (log: Omit<CampaignLog, 'id' | 'createdAt'>) => void | Promise<void>;
  onTargetUpdate?: (target: CampaignTarget) => void | Promise<void>;
  onFinish?: (summary: QueueProgress) => void | Promise<void>;
}
