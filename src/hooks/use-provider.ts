import { useMemo } from 'react';
import { createProvider } from '@/lib/providers/provider-factory';
import { useSettingsStore } from '@/stores/use-settings-store';

export const useProvider = () => {
  const settings = useSettingsStore((state) => state.settings);

  return useMemo(() => {
    if (!settings) {
      return null;
    }

    return createProvider({
      mode: settings.providerMode,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey
    });
  }, [settings]);
};
