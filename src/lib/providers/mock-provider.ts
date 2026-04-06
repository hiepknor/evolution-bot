import type { FetchGroupsOptions, MessagingProvider } from '@/lib/providers/messaging-provider';
import { mockGroups } from '@/mocks/mock-groups';
import type {
  ConnectionState,
  Group,
  SendPayload,
  SendResult,
  TestConnectionResult
} from '@/lib/types/domain';
import { sleep, randomBetween } from '@/lib/utils/delay';

export class MockProvider implements MessagingProvider {
  async testConnection(): Promise<TestConnectionResult> {
    await sleep(300);
    return { ok: true, message: 'Mock provider connected' };
  }

  async fetchInstances(): Promise<string[]> {
    await sleep(300);
    return ['mock-instance'];
  }

  async fetchGroups(_instanceName: string, _options?: FetchGroupsOptions): Promise<Group[]> {
    await sleep(600);
    return mockGroups.map((group) => ({
      ...group,
      syncedAt: new Date().toISOString()
    }));
  }

  async sendMediaToChat(
    _instanceName: string,
    chatId: string,
    media: SendPayload
  ): Promise<SendResult> {
    await sleep(randomBetween(400, 1400));

    if (!media.imagePath && !media.plainText) {
      return { ok: false, error: 'Missing message content' };
    }

    const fail = Math.random() < 0.12;
    if (fail) {
      return {
        ok: false,
        statusCode: 500,
        error: `Simulated failure for ${chatId}`
      };
    }

    return {
      ok: true,
      providerMessageId: `mock-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      statusCode: 200,
      raw: { chatId }
    };
  }

  async getConnectionState(instanceName: string): Promise<ConnectionState> {
    await sleep(150);
    return {
      isConnected: true,
      instanceName,
      state: 'open'
    };
  }
}
