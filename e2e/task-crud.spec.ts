import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, FamilyMember } from './helpers/auth';
import { deleteTaskByTitle } from './helpers/cleanup';
import { waitForQuiet } from './helpers/network';

const TEST_TITLE = `E2E Task ${Date.now()}`;
const EDITED_TITLE = `${TEST_TITLE} (edited)`;

test.describe('Task CRUD', () => {
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
    // Cleanup: remove test tasks by title
    await deleteTaskByTitle(page, TEST_TITLE);
    await deleteTaskByTitle(page, EDITED_TITLE);
    await logout(page);
  });

  test('create a task via modal', async ({ page }) => {
    await page.goto('/tasks');
    await waitForQuiet(page);

    // Click "Add Task" button
    const addBtn = page.getByRole('button', { name: /Add Task/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Wait for custom modal overlay (not shadcn Dialog — uses fixed div)
    const modal = page.locator('.fixed.inset-0.bg-black\\/50');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in the title
    await modal.locator('input[placeholder="Task title..."]').fill(TEST_TITLE);

    // Submit
    await modal.locator('button[type="submit"]').click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify task appears on the page
    await expect(page.getByText(TEST_TITLE)).toBeVisible({ timeout: 10000 });
  });

  test('edit a task title', async ({ page }) => {
    // Create task via API first
    const createRes = await page.request.post('/api/tasks', {
      data: { title: TEST_TITLE },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();

    await page.goto('/tasks');
    await waitForQuiet(page);

    // Edit via API (the UI edit flow varies; test the mutation works)
    const patchRes = await page.request.patch(`/api/tasks/${created.id}`, {
      data: { title: EDITED_TITLE },
    });
    expect(patchRes.ok()).toBeTruthy();

    // Refresh and verify
    await page.reload();
    await waitForQuiet(page);
    await expect(page.getByText(EDITED_TITLE)).toBeVisible({ timeout: 10000 });
  });

  test('toggle task complete and incomplete', async ({ page }) => {
    // Create task via API
    const createRes = await page.request.post('/api/tasks', {
      data: { title: TEST_TITLE },
    });
    const created = await createRes.json();

    await page.goto('/tasks');
    await waitForQuiet(page);

    // Complete via API
    const completeRes = await page.request.patch(`/api/tasks/${created.id}`, {
      data: { completed: true },
    });
    expect(completeRes.ok()).toBeTruthy();
    const completed = await completeRes.json();
    expect(completed.completed).toBe(true);

    // Uncomplete via API
    const uncompleteRes = await page.request.patch(`/api/tasks/${created.id}`, {
      data: { completed: false },
    });
    expect(uncompleteRes.ok()).toBeTruthy();
    const uncompleted = await uncompleteRes.json();
    expect(uncompleted.completed).toBe(false);
  });

  test('delete a task', async ({ page }) => {
    // Create task via API
    const createRes = await page.request.post('/api/tasks', {
      data: { title: TEST_TITLE },
    });
    const created = await createRes.json();

    // Delete via API
    const deleteRes = await page.request.delete(`/api/tasks/${created.id}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify it's gone
    const getRes = await page.request.get(`/api/tasks/${created.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('created task appears in API listing', async ({ page }) => {
    // Create task via API
    const createRes = await page.request.post('/api/tasks', {
      data: { title: TEST_TITLE, priority: 'high' },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Verify it appears in listing
    const listRes = await page.request.get('/api/tasks');
    const data = await listRes.json();
    const tasks = data.tasks || data || [];
    const found = tasks.find((t: { id: string }) => t.id === created.id);
    expect(found).toBeTruthy();
    expect(found.title).toBe(TEST_TITLE);
    expect(found.priority).toBe('high');
  });
});
