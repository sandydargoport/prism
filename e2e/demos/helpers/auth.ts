import { Page } from '@playwright/test';

interface FamilyMember {
  id: string;
  name: string;
  role: string;
}

/**
 * Get all family members from the API.
 */
async function getFamilyMembers(page: Page): Promise<FamilyMember[]> {
  const response = await page.request.get('/api/family');
  const data = await response.json();
  // API returns { members: [...] } or just [...]
  return Array.isArray(data) ? data : data.members;
}

/**
 * Find a family member by name.
 */
async function findMember(page: Page, name: string): Promise<FamilyMember> {
  const members = await getFamilyMembers(page);
  const member = members.find((m: FamilyMember) => m.name === name);
  if (!member) throw new Error(`Member "${name}" not found in: ${members.map(m => m.name).join(', ')}`);
  return member;
}

/**
 * Login via the UI — clicks "Log in" in the SideNav, which opens QuickPinModal,
 * then selects a member and enters PIN digit by digit.
 * Use this for the dashboard overview demo to show the login flow.
 */
export async function loginViaUI(page: Page, name: string, pin = '1234') {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Click the "Log in" button in the SideNav (bottom of aside)
  await page.click('button[aria-label="Log in"]');
  await page.waitForTimeout(800);

  // QuickPinModal opens — select the member
  await page.waitForSelector(`button:has-text("${name}")`, { timeout: 5000 });
  await page.click(`button:has-text("${name}")`);
  await page.waitForTimeout(500);

  // Type PIN digit by digit using keyboard (QuickPinModal supports keyboard input)
  for (const digit of pin) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(200);
  }

  // Wait for modal to close and dashboard to update with logged-in state
  await page.waitForTimeout(2000);
}

/**
 * Login via API — fast, sets cookies directly without showing PIN pad.
 * Use this for scenarios where login is just setup, not the demo focus.
 */
export async function loginViaAPI(page: Page, name: string, pin = '1234') {
  const member = await findMember(page, name);

  const response = await page.request.post('/api/auth/login', {
    data: { userId: member.id, pin },
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${name}: ${response.status()}`);
  }

  return member;
}
