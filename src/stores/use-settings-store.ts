import { create } from 'zustand';
import type { ConnectionBadgeState, ConnectionSettings } from '@/lib/types/domain';
import { settingsRepo } from '@/lib/db/repositories';
import { createProvider } from '@/lib/providers/provider-factory';
import { useActivityLogStore } from '@/stores/use-activity-log-store';

const readSettingsFromEnv = (): Pick<
  ConnectionSettings,
  'baseUrl' | 'apiKey' | 'instanceName' | 'providerMode'
> | null => {
  const baseUrl = (import.meta.env.VITE_EVOLUTION_BASE_URL as string | undefined)?.trim();
  const apiKey = (import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined)?.trim();
  const instanceName = (import.meta.env.VITE_EVOLUTION_INSTANCE_NAME as string | undefined)?.trim();
  const defaultProvider = (import.meta.env.VITE_DEFAULT_PROVIDER as string | undefined)?.trim();
  const mockProvider = (import.meta.env.VITE_MOCK_PROVIDER as string | undefined)?.trim();

  if (!baseUrl || !apiKey || !instanceName) {
    return null;
  }

  const providerMode =
    defaultProvider === 'mock' || mockProvider === 'true' ? 'mock' : 'evolution';

  return {
    baseUrl,
    apiKey,
    instanceName,
    providerMode
  };
};

export interface SettingsState {
  settings: ConnectionSettings | null;
  connectedInstanceName: string | null;
  badgeState: ConnectionBadgeState;
  statusMessage: string;
  loading: boolean;
  load: () => Promise<void>;
  save: (input: Pick<ConnectionSettings, 'baseUrl' | 'apiKey' | 'instanceName' | 'providerMode'>) => Promise<void>;
  testConnection: (input?: Pick<ConnectionSettings, 'baseUrl' | 'apiKey' | 'instanceName' | 'providerMode'>) => Promise<void>;
  disconnect: () => void;
}

const mapConnectionMessage = (raw: string): string => {
  const message = raw.trim();
  if (!message) {
    return 'Kết nối thất bại';
  }

  if (/401/.test(message)) {
    return 'Lỗi 401: API key không hợp lệ.';
  }
  if (/403/.test(message)) {
    return 'Lỗi 403: Không có quyền truy cập instance.';
  }
  if (/404/.test(message)) {
    return 'Lỗi 404: Không tìm thấy endpoint hoặc instance.';
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return 'Hết thời gian chờ kết nối. Hãy kiểm tra Base URL hoặc mạng.';
  }
  if (/network|fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return 'Không thể kết nối máy chủ. Hãy kiểm tra Base URL và trạng thái API.';
  }
  if (/http permission denied|not allowed by acl|plugin:http\|fetch/i.test(message)) {
    return 'Ứng dụng chưa được cấp quyền HTTP tới URL này. Hãy cập nhật bản build mới.';
  }
  if (/connection established/i.test(message)) {
    return 'Kết nối thành công';
  }

  return message;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  connectedInstanceName: null,
  badgeState: 'disconnected',
  statusMessage: 'Chưa kết nối',
  loading: false,

  load: async () => {
    set({ loading: true });
    let settings = await settingsRepo.get();

    if (!settings) {
      const envSettings = readSettingsFromEnv();
      if (envSettings) {
        settings = await settingsRepo.upsert(envSettings);
      }
    }

    set({
      settings,
      connectedInstanceName: settings?.instanceName ?? null,
      loading: false,
      badgeState: settings ? 'disconnected' : 'disconnected',
      statusMessage: settings ? 'Chưa kết nối' : 'Chưa có cấu hình kết nối'
    });
    useActivityLogStore.getState().pushUiLog({
      level: 'info',
      message: settings ? 'Đã tải cấu hình kết nối' : 'Chưa có cấu hình kết nối'
    });
  },

  save: async (input) => {
    set({ loading: true });
    const saved = await settingsRepo.upsert(input);
    set({
      settings: saved,
      connectedInstanceName: saved.instanceName,
      loading: false,
      statusMessage: 'Đã lưu cấu hình'
    });
    useActivityLogStore.getState().pushUiLog({
      level: 'success',
      message: `Đã lưu cấu hình kết nối vào DB cho instance ${saved.instanceName}`
    });
  },

  testConnection: async (input) => {
    const settings = input ?? get().settings;
    if (!settings) {
      set({ badgeState: 'disconnected', statusMessage: 'Thiếu cấu hình kết nối' });
      useActivityLogStore.getState().pushUiLog({
        level: 'warn',
        message: 'Kiểm tra kết nối thất bại: thiếu cấu hình'
      });
      return;
    }

    if (settings.providerMode === 'mock') {
      set({
        badgeState: 'connected',
        connectedInstanceName: settings.instanceName,
        statusMessage: `Kết nối thành công tới ${settings.instanceName}`
      });
      useActivityLogStore.getState().pushUiLog({
        level: 'success',
        message: `Kết nối thành công tới instance ${settings.instanceName}`
      });
      return;
    }

    set({ badgeState: 'checking', statusMessage: 'Đang kiểm tra kết nối...' });

    const provider = createProvider({
      mode: settings.providerMode,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey
    });

    try {
      const availableInstances = await provider.fetchInstances();
      const normalizedConfigured = settings.instanceName.trim().toLowerCase();
      const normalizedAvailable = availableInstances.map((item) => item.trim().toLowerCase());
      const configuredInList = normalizedAvailable.includes(normalizedConfigured);

      if (!configuredInList) {
        const message =
          availableInstances.length > 0
            ? `Instance "${settings.instanceName}" không có trong danh sách khả dụng: ${availableInstances.join(', ')}`
            : `Không tìm thấy instance "${settings.instanceName}" trong phản hồi từ máy chủ.`;
        set({ badgeState: 'disconnected', statusMessage: message });
        useActivityLogStore.getState().pushUiLog({
          level: 'error',
          message: `Kiểm tra kết nối thất bại: ${message}`
        });
        return;
      }

      const connectionState = await provider.getConnectionState(settings.instanceName);
      if (!connectionState.isConnected) {
        const message = `Instance "${settings.instanceName}" chưa kết nối (state: ${connectionState.state}).`;
        set({ badgeState: 'disconnected', statusMessage: message });
        useActivityLogStore.getState().pushUiLog({
          level: 'error',
          message: `Kiểm tra kết nối thất bại: ${message}`
        });
        return;
      }

      set({
        badgeState: 'connected',
        connectedInstanceName: settings.instanceName,
        statusMessage: `Kết nối thành công tới ${settings.instanceName}`
      });
      useActivityLogStore.getState().pushUiLog({
        level: 'success',
        message: `Kết nối thành công tới instance ${settings.instanceName}`
      });
    } catch (error) {
      const fallbackMessage = mapConnectionMessage(
        error instanceof Error ? error.message : 'Kết nối thất bại'
      );
      set({ badgeState: 'disconnected', statusMessage: fallbackMessage });
      useActivityLogStore.getState().pushUiLog({
        level: 'error',
        message: `Kiểm tra kết nối lỗi: ${fallbackMessage}`
      });
    }
  },

  disconnect: () => {
    const instanceName = get().connectedInstanceName ?? get().settings?.instanceName ?? 'không rõ';
    set({
      badgeState: 'disconnected',
      connectedInstanceName: null,
      statusMessage: 'Đã ngắt kết nối'
    });
    useActivityLogStore.getState().pushUiLog({
      level: 'info',
      message: `Đã ngắt kết nối khỏi instance ${instanceName}`
    });
  }
}));
