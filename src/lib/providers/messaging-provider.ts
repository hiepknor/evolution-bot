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

export interface InstanceSyncSettings {
  groupsIgnore: boolean | null;
}

export interface MessagingProvider {
  testConnection(): Promise<TestConnectionResult>;
  fetchInstances(): Promise<string[]>;
  fetchInstanceSyncSettings(instanceName: string): Promise<InstanceSyncSettings>;
  fetchGroups(instanceName: string, options?: FetchGroupsOptions): Promise<Group[]>;
  sendMediaToChat(
    instanceName: string,
    chatId: string,
    media: SendPayload
  ): Promise<SendResult>;
  getConnectionState(instanceName: string): Promise<ConnectionState>;
}
