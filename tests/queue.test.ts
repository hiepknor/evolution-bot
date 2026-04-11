import { describe, expect, it } from 'vitest';
import { BroadcastQueue } from '@/lib/queue/broadcast-queue';
import { MockProvider } from '@/lib/providers/mock-provider';
import type { Campaign, Group } from '@/lib/types/domain';

const campaign: Campaign = {
  id: 'cmp-1',
  name: 'test-campaign',
  captionTemplate: 'Hello {group_name}',
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
    maxAttempts: 1,
    blacklist: [],
    whitelistMode: false,
    warningThreshold: 50
  },
  checksum: 'abc'
};

const groups: Group[] = [
  {
    id: '1',
    chatId: '1@g.us',
    name: 'G1',
    membersCount: 10,
    sendable: true,
    adminOnly: false,
    raw: {},
    syncedAt: new Date().toISOString()
  },
  {
    id: '2',
    chatId: '2@g.us',
    name: 'G2',
    membersCount: 11,
    sendable: true,
    adminOnly: false,
    raw: {},
    syncedAt: new Date().toISOString()
  }
];

describe('broadcast queue', () => {
  it('processes sequentially in dry-run mode', async () => {
    const queue = new BroadcastQueue({
      provider: new MockProvider(),
      instanceName: 'mock-instance',
      campaign,
      groups
    });

    const result = await queue.run();

    expect(result.summary.processed).toBe(2);
    expect(result.summary.sent).toBe(0);
    expect(result.summary.dryRunSuccess).toBe(2);
    expect(result.targets.every((target) => target.status === 'dry-run-success')).toBe(true);
  });

  it('supports pause and resume controls', () => {
    const queue = new BroadcastQueue({
      provider: new MockProvider(),
      instanceName: 'mock-instance',
      campaign,
      groups
    });

    expect(queue.isPaused()).toBe(false);
    queue.pause();
    expect(queue.isPaused()).toBe(true);
    queue.resume();
    expect(queue.isPaused()).toBe(false);
  });
});
