import { expect, test } from '@playwright/test';

import { mockDesktopPersistence } from './test-utils';

test('save connection settings without crashing UI', async ({ page }) => {
  await page.goto('/');
  await mockDesktopPersistence(page);

  const openButton = page.getByRole('button', { name: 'Mở cài đặt kết nối' });
  if (await openButton.isVisible()) {
    await openButton.click();
  }

  const connectionDialog = page.getByRole('dialog', { name: 'Cài đặt kết nối' });
  await expect(connectionDialog).toBeVisible();

  await page.getByPlaceholder('http://localhost:8080 hoặc https://api.example.com').fill('http://localhost:8080');
  await page.getByPlaceholder('apikey...').fill('e2e-key');
  await page.getByPlaceholder('instance-01').fill('test-instance');

  await page.getByRole('button', { name: 'Lưu cấu hình' }).click();

  await expect(page.getByText(/Ghi chú:\s*Đã lưu cấu hình/)).toBeVisible();
  await expect(page.getByText('Evo Broadcast Control')).toBeVisible();
});
