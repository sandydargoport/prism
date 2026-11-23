import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, getFirstChild, FamilyMember } from './helpers/auth';
import { deleteChoreByTitle } from './helpers/cleanup';
import { waitForQuiet } from './helpers/network';

const TEST_TITLE = `E2E Chore ${Date.now()}`;

test.describe('Chore CRUD', () => {
  let parent: FamilyMember;
  let child: FamilyMember | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    try {
      child = await getFirstChild(page);
    } catch {
      // No child user — some tests will be skipped
    }
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, parent.name);
  });

  test.afterEach(async ({ page }) => {
    await deleteChoreByTitle(page, TEST_TITLE);
    await logout(page);
  });

  test('create a chore via API', async ({ page }) => {
    const createRes = await page.request.post('/api/chores', {
      data: {
        title: TEST_TITLE,
        category: 'cleaning',
        frequency: 'weekly',
        pointValue: 5,
        requiresApproval: true,
      },
    });
    expect(createRes.status()).toBe(201);
    const chore = await createRes.json();
    expect(chore.title).toBe(TEST_TITLE);
    expect(chore.pointValue).toBe(5);
    expect(chore.frequency).toBe('weekly');
  });

  test('create chore via modal UI', async ({ page }) => {
    await page.goto('/chores');
    await waitForQuiet(page);

    const addBtn = page.getByRole('button', { name: /Add Chore/i });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Wait for custom modal overlay (not shadcn Dialog — uses fixed div)
    const modal = page.locator('.fixed.inset-0.bg-black\\/50');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill chore title
    await modal.locator('input[placeholder="Chore title..."]').fill(TEST_TITLE);

    // Submit
    await modal.locator('button[type="submit"]').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Verify chore appears on page
    await expect(page.getByText(TEST_TITLE)).toBeVisible({ timeout: 10000 });
  });

  test('complete a chore as parent (auto-approve)', async ({ page }) => {
    // Create chore via API
    const createRes = await page.request.post('/api/chores', {
      data: {
        title: TEST_TITLE,
        category: 'cleaning',
        frequency: 'daily',
        pointValue: 3,
        requiresApproval: false,
      },
    });
    const chore = await createRes.json();

    // Complete as parent
    const completeRes = await page.request.post(`/api/chores/${chore.id}/complete`, {
      data: { completedBy: parent.id },
    });
    expect(completeRes.status()).toBe(201);
    const completion = await completeRes.json();
    expect(completion.approved).toBe(true);
    expect(completion.pointsAwarded).toBe(3);
    expect(completion.requiresApproval).toBe(false);
  });

  test('complete chore as child requires approval', async ({ page }) => {
    test.skip(!child, 'No child user available');

    // Create chore via API
    const createRes = await page.request.post('/api/chores', {
      data: {
        title: TEST_TITLE,
        category: 'dishes',
        frequency: 'daily',
        pointValue: 5,
        requiresApproval: true,
      },
    });
    const chore = await createRes.json();

    // Complete as child
    const completeRes = await page.request.post(`/api/chores/${chore.id}/complete`, {
      data: { completedBy: child!.id },
    });
    expect(completeRes.status()).toBe(201);
    const completion = await completeRes.json();
    expect(completion.approved).toBe(false);
    expect(completion.requiresApproval).toBe(true);
    expect(completion.isChildCompletion).toBe(true);

    // Approve as parent
    const approveRes = await page.request.post(`/api/chores/${chore.id}/approve`, {
      data: { completionId: completion.id },
    });
    expect(approveRes.ok()).toBeTruthy();
    const approved = await approveRes.json();
    expect(approved.completion.pointsAwarded).toBe(5);
  });

  test('disable a chore prevents completion', async ({ page }) => {
    // Create chore
    const createRes = await page.request.post('/api/chores', {
      data: {
        title: TEST_TITLE,
        category: 'trash',
        frequency: 'weekly',
        pointValue: 2,
      },
    });
    const chore = await createRes.json();

    // Disable it
    const disableRes = await page.request.patch(`/api/chores/${chore.id}`, {
      data: { enabled: false },
    });
    expect(disableRes.ok()).toBeTruthy();

    // Try to complete — should fail with 400
    const completeRes = await page.request.post(`/api/chores/${chore.id}/complete`, {
      data: { completedBy: parent.id },
    });
    expect(completeRes.status()).toBe(400);
    const body = await completeRes.json();
    expect(body.error).toContain('disabled');
  });
});
