import { expect, test } from '@playwright/test';

import {
  closeConnectionModalIfOpen,
  forceMockConnectedState,
  mockDesktopPersistence
} from './test-utils';

test('sync groups, filter by search, and select one group', async ({ page }) => {
  await page.goto('/');
  await mockDesktopPersistence(page);
  await forceMockConnectedState(page);
  await closeConnectionModalIfOpen(page);

  await page.getByRole('button', { name: 'Đồng bộ danh sách nhóm' }).click();

  await expect(page.locator('tbody tr')).toHaveCount(48);

  const searchInput = page.getByPlaceholder('Tìm theo tên nhóm hoặc chat id');
  await searchInput.fill('Demo Group 48');

  await expect(page.locator('tbody tr')).toHaveCount(1);

  await page.locator('tbody button[role="checkbox"]').first().click({ force: true });

  await expect(page.getByText(/^1 đã chọn$/)).toBeVisible();
});
