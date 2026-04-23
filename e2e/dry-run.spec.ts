import { test } from '@playwright/test';

// Running campaign queue in browser-only mode is flaky because Tauri runtime
// dependencies (SQL/keychain/filesystem) are not fully available in Playwright web context.
test.skip('dry run from Operations tab without API errors', async () => {
  // Covered manually in Tauri runtime; kept as documented limitation for PR body.
});
