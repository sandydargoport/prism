import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Away mode overlay', async ({ page }) => {
  resetDemoData();

  const member = await loginViaAPI(page, 'Alex');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Enable away mode via API (skip PIN modal for clean recording)
  await page.request.post('/api/away-mode', {
    data: { enabled: true, enabledBy: member.id, autoActivated: true },
  });

  // Dispatch custom event to trigger immediate overlay activation
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('prism:away-mode-change', {
      detail: { enabled: true },
    }));
  });

  // Show the away mode overlay (clock + weather + photos)
  await page.waitForTimeout(5000);
});
