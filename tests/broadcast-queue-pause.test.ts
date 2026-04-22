import { describe, expect, it, vi } from 'vitest';
import { BroadcastQueue } from '@/lib/queue/broadcast-queue';
import type { Campaign, ConnectionState, Group, SendResult, TestConnectionResult } from '@/lib/types/domain';
import type { FetchGroupsOptions, InstanceSyncSettings, MessagingProvider } from '@/lib/providers/messaging-provider';

const now = new Date().toISOString();

const groups: Group[] = [
  { id: '1', chatId: '1@g.us', name: 'G1', membersCount: 10, sendable: true, adminOnly: false, raw: {}, syncedAt: now },
  { id: '2', chatId: '2@g.us', name: 'G2', membersCount: 20, sendable: true, adminOnly: false, raw: {}, syncedAt: now }
];

const baseCampaign: Campaign = {
  id: 'cmp-queue',
  name: 'queue-test',
  captionTemplate: 'Hi {group_name}',
  introText: '',
  titleText: '',
  footerText: '',
  plainTextFallback: '',
  emojiMode: 'none',
  dryRun: true,
  status: 'running',
  totalTargets: 2,
  sentCount: 0,
  failedCount: 0,
  skippedCount: 0,
  config: {
    randomDelayMinMs: 0,
    randomDelayMaxMs: 0,
    pauseEvery: 0,
    pauseDurationMs: 0,
    maxAttempts: 3,
    blacklist: [],
    whitelistMode: false,
    warningThreshold: 50
  },
  checksum: 'sum'
};

class RetryFailProvider implements MessagingProvider {
  async testConnection(): Promise<TestConnectionResult> {
    return { ok: true, message: 'ok' };
  }

  async fetchInstances(): Promise<string[]> {
    return ['mock'];
  }

  async fetchInstanceSyncSettings(_instanceName: string): Promise<InstanceSyncSettings> {
    return { groupsIgnore: false };
  }

  async fetchGroups(_instanceName: string, _options?: FetchGroupsOptions): Promise<Group[]> {
    return groups;
  }

  async sendMediaToChat(): Promise<SendResult> {
    return { ok: false, error: 'send failed' };
  }

  async getConnectionState(_instanceName: string): Promise<ConnectionState> {
    return { isConnected: true, instanceName: 'mock', state: 'open' };
  }
}

describe('broadcast queue pause behavior', () => {
  it('pauses and resumes while running', async () => {
    vi.useFakeTimers();

    const queue = new BroadcastQueue({
      provider: new RetryFailProvider(),
      instanceName: 'mock',
      campaign: { ...baseCampaign, dryRun: true },
      groups
    });

    let completed = false;
    const runPromise = queue.run().then((result) => {
      completed = true;
      return result;
    });

    queue.pause();
    await vi.advanceTimersByTimeAsync(1200);
    expect(completed).toBe(false);

    queue.resume();
    await vi.runAllTimersAsync();

    const result = await runPromise;
    expect(result.summary.dryRunSuccess).toBe(2);
    expect(result.targets.every((target) => target.status === 'dry-run-success')).toBe(true);

    vi.useRealTimers();
  });

  it('can stop between retries and mark target cancelled', async () => {
    const queue = new BroadcastQueue({
      provider: new RetryFailProvider(),
      instanceName: 'mock',
      campaign: { ...baseCampaign, dryRun: false, totalTargets: 1 },
      groups: [groups[0]!],
      callbacks: {
        onLog: (log) => {
          if (log.message.startsWith('Thử lại')) {
            queue.stop();
          }
        }
      }
    });

    const result = await queue.run();
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.failed).toBe(0);
    expect(result.targets[0]?.status).toBe('cancelled');
    expect(result.targets[0]?.attempts).toBe(1);
  });
});
