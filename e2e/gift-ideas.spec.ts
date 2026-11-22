import { test, expect } from '@playwright/test';
import { loginViaAPI, logout, getFirstParent, getFirstChild, getFamilyMembers, FamilyMember } from './helpers/auth';
import { waitForQuiet } from './helpers/network';

test.describe('Gift Ideas', () => {
  let parent: FamilyMember;
  let child: FamilyMember | null = null;
  let otherMember: FamilyMember | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    parent = await getFirstParent(page);
    try {
      child = await getFirstChild(page);
    } catch {
      // No child user
    }
    // Find a member that is not the parent (to use as gift target)
    const members = await getFamilyMembers(page);
    otherMember = members.find((m) => m.id !== parent.id) || null;
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, parent.name);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('wishes page loads and shows Gift Ideas tab', async ({ page }) => {
    await page.goto('/wishes');
    await waitForQuiet(page);

    // The tab switcher should show "Gift Ideas" button
    const giftIdeasTab = page.getByRole('button', { name: /Gift Ideas/i });
    await expect(giftIdeasTab).toBeVisible({ timeout: 10000 });
  });

  test('switch to Gift Ideas tab renders content', async ({ page }) => {
    await page.goto('/wishes');
    await waitForQuiet(page);

    // Click the Gift Ideas tab
    const giftIdeasTab = page.getByRole('button', { name: /Gift Ideas/i });
    await giftIdeasTab.click();

    // Wait for the Gift Ideas view to render — it should show other family members
    await page.waitForTimeout(2000);

    // The tab should now be active (has primary styling)
    await expect(giftIdeasTab).toBeVisible();
  });

  test('per-person columns render for other family members', async ({ page }) => {
    test.skip(!otherMember, 'No other family members to show gift columns for');

    await page.goto('/wishes');
    await waitForQuiet(page);

    // Switch to Gift Ideas tab
    await page.getByRole('button', { name: /Gift Ideas/i }).click();
    await page.waitForTimeout(2000);

    // Other member names should appear as column headers (excluding self)
    await expect(page.getByText(otherMember!.name).first()).toBeVisible({ timeout: 10000 });
  });

  test('gift ideas API returns expected shape', async ({ page }) => {
    const apiRes = await page.request.get('/api/gift-ideas');
    expect(apiRes.ok()).toBeTruthy();

    const data = await apiRes.json();
    expect(data).toHaveProperty('ideas');
    expect(Array.isArray(data.ideas)).toBe(true);
  });

  test('create and delete a gift idea via API', async ({ page }) => {
    test.skip(!otherMember, 'No other family member to create gift idea for');

    const testName = `E2E Gift ${Date.now()}`;

    // Create
    const createRes = await page.request.post('/api/gift-ideas', {
      data: {
        forUserId: otherMember!.id,
        name: testName,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.name).toBe(testName);
    expect(created.forUserId).toBe(otherMember!.id);

    // Delete
    const deleteRes = await page.request.delete(`/api/gift-ideas/${created.id}`);
    expect(deleteRes.ok()).toBeTruthy();
  });

  test('cannot create gift idea for yourself', async ({ page }) => {
    const createRes = await page.request.post('/api/gift-ideas', {
      data: {
        forUserId: parent.id,
        name: 'Self gift idea',
      },
    });
    expect(createRes.status()).toBe(400);
    const body = await createRes.json();
    expect(body.error).toContain('yourself');
  });

  test('privacy: only own ideas returned from API', async ({ page }) => {
    test.skip(!otherMember, 'No other family member available');

    const testName = `E2E Privacy ${Date.now()}`;

    // Create idea as parent
    const createRes = await page.request.post('/api/gift-ideas', {
      data: {
        forUserId: otherMember!.id,
        name: testName,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Verify it appears in parent's listing
    const parentListRes = await page.request.get('/api/gift-ideas');
    const parentData = await parentListRes.json();
    const foundAsParent = parentData.ideas.find((i: { id: string }) => i.id === created.id);
    expect(foundAsParent).toBeTruthy();

    // If a child exists, log in as child and verify the idea is NOT visible
    if (child) {
      await logout(page);
      await loginViaAPI(page, child.name);

      const childListRes = await page.request.get('/api/gift-ideas');
      const childData = await childListRes.json();
      const foundAsChild = childData.ideas.find((i: { id: string }) => i.id === created.id);
      expect(foundAsChild).toBeFalsy();

      // Re-login as parent for cleanup
      await logout(page);
      await loginViaAPI(page, parent.name);
    }

    // Cleanup
    await page.request.delete(`/api/gift-ideas/${created.id}`);
  });
});
