import type {
  ConnectionState,
  Group,
  SendPayload,
  SendResult,
  TestConnectionResult
} from '@/lib/types/domain';

export interface FetchGroupsOptions {
  previousGroups?: Group[];
}

export interface MessagingProvider {
  testConnection(): Promise<TestConnectionResult>;
  fetchInstances(): Promise<string[]>;
  fetchGroups(instanceName: string, options?: FetchGroupsOptions): Promise<Group[]>;
  sendMediaToChat(
    instanceName: string,
    chatId: string,
    media: SendPayload
  ): Promise<SendResult>;
  getConnectionState(instanceName: string): Promise<ConnectionState>;
}
