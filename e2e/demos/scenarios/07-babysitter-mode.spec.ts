import { test } from '@playwright/test';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData, seedBabysitterInfo } from '../helpers/reset';

test('Babysitter mode overlay', async ({ page }) => {
  resetDemoData();
  seedBabysitterInfo();

  const member = await loginViaAPI(page, 'Alex');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Enable babysitter mode via API
  await page.request.post('/api/babysitter-mode', {
    data: { enabled: true, enabledBy: member.id },
  });

  // Dispatch custom event for immediate overlay activation
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('prism:babysitter-mode-change', {
      detail: { enabled: true },
    }));
  });

  // Show babysitter overlay (emergency contacts, children info, house rules)
  await page.waitForTimeout(5000);
});
