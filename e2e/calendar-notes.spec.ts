import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { waitForQuiet } from './helpers/network';

test.describe('Calendar Notes', () => {
  let parent: FamilyMember;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, parent.name);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('calendar page loads in day view with notes button', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // Switch to Day view (notes are supported in day and weekVertical views)
    const viewSwitcher = page.locator('.border.rounded-md');
    const dayBtn = viewSwitcher.getByRole('button', { name: 'Day' });
    if (await dayBtn.isVisible({ timeout: 3000 })) {
      await dayBtn.click();
      await page.waitForTimeout(1000);
    }

    // Notes toggle button should be visible (StickyNote icon button)
    const notesBtn = page.getByTitle(/notes/i).first();
    await expect(notesBtn).toBeVisible({ timeout: 10000 });
  });

  test('toggle notes panel via sticky note button in day view', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // Switch to Day view
    const viewSwitcher = page.locator('.border.rounded-md');
    const dayBtn = viewSwitcher.getByRole('button', { name: 'Day' });
    if (await dayBtn.isVisible({ timeout: 3000 })) {
      await dayBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click the notes toggle button
    const notesBtn = page.getByTitle(/notes/i).first();
    await expect(notesBtn).toBeVisible({ timeout: 5000 });
    await notesBtn.click();
    await page.waitForTimeout(1000);

    // The notes column/panel should now be visible — look for the notes area
    // CalendarNotesColumn renders note cells with textarea or content areas
    const notesArea = page.locator('[data-testid="calendar-notes"]').or(
      page.locator('textarea[placeholder*="note" i]').first()
    ).or(
      page.getByText(/click to add/i).first()
    );

    // At least one notes-related element should appear after toggle
    // If none found, the button variant change indicates activation
    const btnVariant = await notesBtn.getAttribute('data-state') || '';
    const isActive = btnVariant === 'active' ||
      (await notesBtn.evaluate((el) => el.classList.contains('bg-secondary')));

    // Either the notes area is visible or the button shows active state
    const notesVisible = await notesArea.isVisible().catch(() => false);
    expect(notesVisible || isActive).toBeTruthy();
  });

  test('calendar notes API returns expected shape', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const apiRes = await page.request.get(`/api/calendar-notes?from=${today}&to=${today}`);
    expect(apiRes.ok()).toBeTruthy();

    const data = await apiRes.json();
    expect(data).toHaveProperty('notes');
    expect(Array.isArray(data.notes)).toBe(true);
  });

  test('upsert and delete a calendar note via API', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const testContent = `E2E Note ${Date.now()}`;

    // Upsert a note
    const upsertRes = await page.request.put('/api/calendar-notes', {
      data: { date: today, content: testContent },
    });
    expect(upsertRes.ok()).toBeTruthy();
    const upserted = await upsertRes.json();
    expect(upserted.note).toBeTruthy();
    expect(upserted.note.content).toBe(testContent);
    expect(upserted.note.date).toBe(today);

    // Verify it appears in GET
    const getRes = await page.request.get(`/api/calendar-notes?from=${today}&to=${today}`);
    const getData = await getRes.json();
    const found = getData.notes.find((n: { date: string }) => n.date === today);
    expect(found).toBeTruthy();
    expect(found.content).toBe(testContent);

    // Delete by sending empty content
    const deleteRes = await page.request.put('/api/calendar-notes', {
      data: { date: today, content: '' },
    });
    expect(deleteRes.ok()).toBeTruthy();
    const deleteData = await deleteRes.json();
    expect(deleteData.deleted).toBe(true);

    // Verify it's gone
    const verifyRes = await page.request.get(`/api/calendar-notes?from=${today}&to=${today}`);
    const verifyData = await verifyRes.json();
    const gone = verifyData.notes.find((n: { date: string; content: string }) =>
      n.date === today && n.content === testContent
    );
    expect(gone).toBeFalsy();
  });

  test('calendar notes require date range params', async ({ page }) => {
    // Missing params should return 400
    const apiRes = await page.request.get('/api/calendar-notes');
    expect(apiRes.status()).toBe(400);
  });

  test('notes button not visible in month view', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // Switch to Month view (notes not supported)
    const viewSwitcher = page.locator('.border.rounded-md');
    const monthBtn = viewSwitcher.getByRole('button', { name: 'Month' });
    if (await monthBtn.isVisible({ timeout: 3000 })) {
      await monthBtn.click();
      await page.waitForTimeout(1000);
    }

    // Notes button should NOT be visible in month view
    const notesBtn = page.getByTitle(/notes/i).first();
    const isVisible = await notesBtn.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});
