import type { Page } from '@playwright/test';

export async function mockDesktopPersistence(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const repos = await import('/src/lib/db/repositories.ts');

    let savedSettings = {
      id: 'e2e-settings',
      baseUrl: 'http://localhost:8080',
      apiKey: 'e2e-api-key',
      instanceName: 'test-instance',
      providerMode: 'evolution' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repos.settingsRepo.get = async () => savedSettings;
    repos.settingsRepo.upsert = async (input) => {
      savedSettings = {
        ...savedSettings,
        ...input,
        updatedAt: new Date().toISOString()
      };
      return savedSettings;
    };

    repos.groupsRepo.list = async () => [];
    repos.groupsRepo.replaceAll = async () => {};
    repos.groupsRepo.clear = async () => {};

    repos.campaignPreferencesRepo.get = async () => null;
    repos.campaignPreferencesRepo.upsert = async () => {};

    repos.quickContentItemsRepo.list = async () => [];
    repos.quickContentItemsRepo.create = async (input) => ({
      id: 'e2e-quick-content',
      label: input.label,
      content: input.content,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    repos.quickContentItemsRepo.update = async () => {};
    repos.quickContentItemsRepo.remove = async () => {};
    repos.quickContentItemsRepo.reorder = async () => {};

    repos.campaignsRepo.recoverInterrupted = async () => {};
    repos.campaignsRepo.list = async () => [];
  });
}

export async function forceMockConnectedState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { useSettingsStore } = await import('/src/stores/use-settings-store.ts');

    useSettingsStore.setState({
      settings: {
        id: 'e2e-settings',
        baseUrl: 'http://localhost:8080',
        apiKey: 'mock-key',
        instanceName: 'mock-instance',
        providerMode: 'mock',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      connectedInstanceName: 'mock-instance',
      badgeState: 'connected',
      statusMessage: 'Kết nối thành công tới mock-instance',
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulCheckedAt: new Date().toISOString(),
      lastErrorMessage: null,
      loading: false
    });
  });
}

export async function closeConnectionModalIfOpen(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Đóng cài đặt kết nối' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}
