import { test } from '@playwright/test';
import { onCanvas, openPanel } from '../../helpers/canvasEditor';
import { loginViaAPI } from '../helpers/auth';
import { resetDemoData } from '../helpers/reset';

test('Dashboard overview — logged in with layout editor', async ({ page }) => {
  resetDemoData();

  // Login via API so the video starts already authenticated
  await loginViaAPI(page, 'Alex');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Pause on dashboard to show widgets in logged-in state
  await page.waitForTimeout(3000);

  // Hover SideNav to expand it
  await page.hover('aside');
  await page.waitForTimeout(2000);

  // Move mouse away to collapse nav
  await page.mouse.move(640, 360);
  await page.waitForTimeout(1000);

  // Open the editor from the dock: Menu, More, Edit layout (#922). It opens
  // the canvas, the dashboard at a screen's size beside the panels (#1283).
  await page.click('[data-dock-menu]');
  await page.click('[data-dock-more]');
  await page.click('[data-dock-more-panel] [data-screen-job="edit"]');
  await onCanvas(page);
  await page.waitForTimeout(2000);

  // Show it at another screen size, then back.
  const size = page.locator('[data-canvas-size]');
  await size.selectOption('1280x800');
  await page.waitForTimeout(2000);
  await size.selectOption('1080x1920');
  await page.waitForTimeout(2000);
  await size.selectOption('1920x1080');
  await page.waitForTimeout(1500);

  // Each panel in turn.
  for (const panel of ['dashboard', 'day', 'look', 'widgets'] as const) {
    await openPanel(page, panel);
    await page.waitForTimeout(1500);
  }

  // Leave without changing anything.
  await page.click('[data-editor-cancel]');
  await page.waitForTimeout(1000);
});
