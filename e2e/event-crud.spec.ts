import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { deleteEventByTitle } from './helpers/cleanup';
import { waitForQuiet } from './helpers/network';

const TEST_TITLE = `E2E Event ${Date.now()}`;
const EDITED_TITLE = `${TEST_TITLE} (edited)`;

test.describe('Event CRUD', () => {
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
    await deleteEventByTitle(page, TEST_TITLE);
    await deleteEventByTitle(page, EDITED_TITLE);
    await logout(page);
  });

  test('create an event via API', async ({ page }) => {
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0).toISOString();

    const createRes = await page.request.post('/api/events', {
      data: {
        title: TEST_TITLE,
        startTime,
        endTime,
        allDay: false,
        createdBy: parent.id,
      },
    });
    expect(createRes.status()).toBe(201);
    const event = await createRes.json();
    expect(event.title).toBe(TEST_TITLE);
    expect(event.id).toBeTruthy();
  });

  test('create event via modal UI', async ({ page }) => {
    await page.goto('/calendar');
    await waitForQuiet(page);

    // Look for Add Event button
    const addBtn = page.getByRole('button', { name: /Add Event/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill event title
    await dialog.locator('#event-title').fill(TEST_TITLE);

    // Fill start and end times
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startVal = formatDatetimeLocal(tomorrow, 14, 0);
    const endVal = formatDatetimeLocal(tomorrow, 15, 0);

    await dialog.locator('#event-start').fill(startVal);
    await dialog.locator('#event-end').fill(endVal);

    // Submit
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('edit an event', async ({ page }) => {
    // Create via API
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0).toISOString();

    const createRes = await page.request.post('/api/events', {
      data: { title: TEST_TITLE, startTime, endTime, createdBy: parent.id },
    });
    const event = await createRes.json();

    // Edit via API
    const patchRes = await page.request.patch(`/api/events/${event.id}`, {
      data: { title: EDITED_TITLE, location: 'Test Location' },
    });
    expect(patchRes.ok()).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.title).toBe(EDITED_TITLE);
    expect(updated.location).toBe('Test Location');
  });

  test('delete an event', async ({ page }) => {
    // Create via API
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0).toISOString();

    const createRes = await page.request.post('/api/events', {
      data: { title: TEST_TITLE, startTime, endTime, createdBy: parent.id },
    });
    const event = await createRes.json();

    // Delete
    const deleteRes = await page.request.delete(`/api/events/${event.id}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify it's gone
    const getRes = await page.request.get(`/api/events/${event.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('toggle all-day on an event', async ({ page }) => {
    // Create a timed event
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0).toISOString();

    const createRes = await page.request.post('/api/events', {
      data: { title: TEST_TITLE, startTime, endTime, allDay: false, createdBy: parent.id },
    });
    const event = await createRes.json();
    expect(event.allDay).toBe(false);

    // Toggle to all-day
    const patchRes = await page.request.patch(`/api/events/${event.id}`, {
      data: { allDay: true },
    });
    expect(patchRes.ok()).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.allDay).toBe(true);
  });
});

/** Format a Date as yyyy-MM-ddTHH:mm for datetime-local inputs */
function formatDatetimeLocal(date: Date, hours: number, minutes: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(hours).padStart(2, '0');
  const min = String(minutes).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}
