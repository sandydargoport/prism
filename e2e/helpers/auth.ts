import { Page, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  /**
   * Present on the unauthenticated `/api/family` response. Used as a fallback
   * for `loginViaAPI` when the caller has no session yet — the public response
   * intentionally redacts real UUIDs (id is '') and exposes loginIndex instead.
   */
  loginIndex?: number;
}

/**
 * Get all family members from the API.
 */
export async function getFamilyMembers(page: Page): Promise<FamilyMember[]> {
  const response = await page.request.get('/api/family');
  const data = await response.json();
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
 * Get the first parent member.
 */
export async function getFirstParent(page: Page): Promise<FamilyMember> {
  const members = await getFamilyMembers(page);
  const parent = members.find((m: FamilyMember) => m.role === 'parent');
  if (!parent) throw new Error('No parent found');
  return parent;
}

/**
 * Get the first child member.
 */
export async function getFirstChild(page: Page): Promise<FamilyMember> {
  const members = await getFamilyMembers(page);
  const child = members.find((m: FamilyMember) => m.role === 'child');
  if (!child) throw new Error('No child found');
  return child;
}

/** Default PIN — override via E2E_PIN environment variable. */
const DEFAULT_PIN = process.env.E2E_PIN || '1234';

/** Locator for the QuickPinModal overlay (rendered via portal). */
const MODAL_SELECTOR = '[data-testid="pin-modal"]';

/**
 * Login via the UI — clicks "Log in", selects member, enters PIN digit by digit.
 */
export async function loginViaUI(page: Page, name: string, pin = DEFAULT_PIN) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Click the "Log in" button in the nav
  await page.click('button[aria-label="Log in"]');

  // QuickPinModal opens (title is "Login" when triggered from nav)
  const modal = page.locator(MODAL_SELECTOR);
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Select the member — scoped to the modal to avoid matching other buttons
  const memberBtn = modal.locator(`button:has-text("${name}")`);
  await memberBtn.click();

  // Type PIN digit by digit using keyboard
  for (const digit of pin) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(150);
  }

  // Wait for modal to close and auth state to settle
  await page.waitForTimeout(1500);
}

/**
 * Build the credential payload both PIN endpoints accept.
 *
 * The public /api/family response redacts real UUIDs and returns loginIndex
 * instead — fall back to memberIndex when we don't have a real id.
 */
async function pinCredentials(page: Page, name: string, pin: string) {
  const member = await findMember(page, name);
  const data: Record<string, unknown> = { pin };
  if (member.id) data.userId = member.id;
  else if (typeof member.loginIndex === 'number') data.memberIndex = member.loginIndex;
  else throw new Error(`Member "${name}" has neither id nor loginIndex`);
  return { member, data };
}

/**
 * Login via API — fast, sets cookies directly without showing PIN pad.
 */
export async function loginViaAPI(page: Page, name: string, pin = DEFAULT_PIN) {
  const { member, data } = await pinCredentials(page, name, pin);

  const response = await page.request.post('/api/auth/login', { data });

  if (!response.ok()) {
    throw new Error(`Login failed for ${name}: ${response.status()}`);
  }

  return member;
}

/**
 * Clear the settings PIN gate via API.
 *
 * `/settings` is behind a SECOND gate on top of the session: SettingsPinGate
 * asks /api/auth/settings-verified and shows the "Parent PIN Required" prompt
 * unless the session has been verified within the last 10 minutes. A plain
 * `loginViaAPI` does not set that flag, so a test that only logs in lands on
 * the prompt rather than on settings.
 *
 * POST /api/auth/verify-pin sets it (and creates a session if there isn't one
 * yet), which makes this a superset of `loginViaAPI` for parents.
 */
export async function verifySettingsPinViaAPI(page: Page, name: string, pin = DEFAULT_PIN) {
  const { member, data } = await pinCredentials(page, name, pin);

  const response = await page.request.post('/api/auth/verify-pin', { data });

  if (!response.ok()) {
    throw new Error(`Settings PIN verification failed for ${name}: ${response.status()}`);
  }

  return member;
}

/**
 * Logout via API — clears session cookies.
 */
export async function logout(page: Page) {
  await page.request.post('/api/auth/logout');
}

/**
 * Query the seeded parent's id straight from the DB.
 *
 * `getFamilyMembers` reads /api/family, which redacts ids for unauthenticated
 * callers, so a spec that has no session yet cannot find a parent through the
 * API. Two execution paths, because dev and CI hold the database differently:
 *
 *   - Local (Windows dev): postgres is in the `prism-db` container and `psql`
 *     may not exist on the host, so reach in with `docker exec`.
 *   - CI: postgres is a service container and the runner has `psql`, so use
 *     DATABASE_URL.
 *
 * Only call this behind `E2E_HAS_TEST_DB=1`. It assumes a seeded database.
 */
export function getSeededParentId(): string {
  const cmd = process.env.DATABASE_URL
    ? `psql "${process.env.DATABASE_URL}" -At -c "SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`
    : `docker exec prism-db psql -U prism -d prism -At -c "SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1"`;
  const out = execSync(cmd, { encoding: 'utf-8' }).trim();
  if (!out) throw new Error('No seeded parent in DB: did seeds run?');
  return out;
}
