import { invoke } from '@tauri-apps/api/core';

const hasTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

const KEYCHAIN_ERROR_PREFIX = 'Không thể truy cập secure keychain';

export const saveApiKeyToKeychain = async (value: string): Promise<void> => {
  if (!hasTauriRuntime()) {
    return;
  }
  try {
    await invoke('save_api_key', { value });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${KEYCHAIN_ERROR_PREFIX}: ${message}`);
  }
};

export const loadApiKeyFromKeychain = async (): Promise<string | null> => {
  if (!hasTauriRuntime()) {
    return null;
  }
  try {
    const value = await invoke<string | null>('load_api_key');
    return value ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${KEYCHAIN_ERROR_PREFIX}: ${message}`);
  }
};

export const clearApiKeyFromKeychain = async (): Promise<void> => {
  if (!hasTauriRuntime()) {
    return;
  }
  try {
    await invoke('clear_api_key');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${KEYCHAIN_ERROR_PREFIX}: ${message}`);
  }
};
