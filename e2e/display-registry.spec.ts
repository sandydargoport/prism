/**
 * Display registry (#690): a screen is named from itself, and every other
 * device sees it, can rename it, and can remove it.
 *
 * Two browser contexts stand in for the wall screen and a parent's phone, so
 * the cookies are really separate: only the wall carries the display cookie.
 * Runs against a fresh-seeded database only (it adds and removes a row).
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { getFirstParent, verifySettingsPinViaAPI } from './helpers/auth';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

async function openDisplays(context: BrowserContext, parentName: string): Promise<Page> {
  const page = await context.newPage();
  await verifySettingsPinViaAPI(page, parentName);
  await page.goto('/settings?section=displays');
  await expect(page.getByRole('heading', { name: 'Displays', level: 2 })).toBeVisible();
  return page;
}

test.describe('Display registry', () => {
  test('name a screen on itself, then rename and remove it from another device', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    // The first visit compiles Settings and the display routes on the dev server.
    test.setTimeout(120_000);
    // Names unique to this attempt, so a retry is not confused by rows an
    // earlier attempt left behind.
    const tag = Date.now().toString(36);
    const KITCHEN = `Kitchen ${tag}`;
    const RENAMED = `Kitchen wall ${tag}`;

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    try {
      // On the wall: name it.
      const wall = await openDisplays(wallContext, parent.name);
      await expect(wall.getByLabel('Name for this screen')).toBeVisible({ timeout: 60_000 });
      await wall.getByLabel('Name for this screen').fill(KITCHEN);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText(KITCHEN);
      const wallRow = wall.getByTestId('display-row').filter({ hasText: KITCHEN });
      await expect(wallRow).toContainText('This screen');
      await expect(wallRow).toContainText('Online');

      // On the phone: listed, online, and not "this screen".
      const phone = await openDisplays(phoneContext, parent.name);
      const phoneRow = phone.getByTestId('display-row').filter({ hasText: KITCHEN });
      await expect(phoneRow).toContainText('Online');
      await expect(phoneRow).not.toContainText('This screen');
      await expect(phone.getByLabel('Name for this screen')).toBeVisible();

      // Rename from the phone; the wall shows it after a refresh.
      await phoneRow.getByRole('button', { name: 'Rename' }).click();
      await phone.getByLabel(`New name for ${KITCHEN}`).fill(RENAMED);
      await phone.getByRole('button', { name: 'Save' }).click();
      await expect(phone.getByTestId('display-row').filter({ hasText: RENAMED })).toBeVisible();
      await wall.reload();
      await expect(wall.getByText('This screen is named')).toContainText(RENAMED);

      // Remove from the phone; the wall's next heartbeat forgets its name.
      phone.once('dialog', (d) => d.accept());
      await phone.getByTestId('display-row').filter({ hasText: RENAMED })
        .getByRole('button', { name: 'Remove' }).click();
      await expect(phone.getByTestId('display-row').filter({ hasText: RENAMED })).toHaveCount(0);

      const beat = await wall.request.post('/api/displays/heartbeat');
      expect((await beat.json()).display).toBeNull();
      const cookies = await wallContext.cookies();
      expect(cookies.find((c) => c.name === 'prism_display')).toBeUndefined();
      await wall.reload();
      await expect(wall.getByLabel('Name for this screen')).toBeVisible();
    } finally {
      await wallContext.close();
      await phoneContext.close();
    }
  });
});

/** A stored value, or null while the page is in the middle of reloading itself. */
async function readStorage(page: Page, key: string): Promise<string | null> {
  try {
    return await page.evaluate((k) => localStorage.getItem(k), key);
  } catch {
    return null;
  }
}

test.describe('Display settings follow the screen', () => {
  test('edited from a phone, changed on the screen, and back after a browser reset', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(180_000);
    const tag = Date.now().toString(36);
    const HALL = `Hall ${tag}`;
    const TIMEOUT = 'prism-screensaver-timeout';

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    const resetContext = await browser.newContext();
    try {
      const phone = await openDisplays(phoneContext, parent.name);
      const stored = async () => {
        const { displays } = await (await phone.request.get('/api/displays')).json();
        return displays.find((d: { name: string }) => d.name === HALL);
      };

      // The wall already has a setting of its own when it is named; naming copies it up.
      const wall = await openDisplays(wallContext, parent.name);
      await wall.evaluate((k) => localStorage.setItem(k, '300'), TIMEOUT);
      await wall.getByLabel('Name for this screen').fill(HALL);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect.poll(async () => (await stored())?.settings?.[TIMEOUT], { timeout: 15_000 }).toBe('300');

      // Edited from the phone: the wall has it after a refresh.
      const hall = await stored();
      const patch = await phone.request.patch(`/api/displays/${hall.id}`, { data: { settings: { [TIMEOUT]: '600' } } });
      expect(patch.ok()).toBe(true);
      await wall.reload();
      await expect.poll(() => readStorage(wall, TIMEOUT), { timeout: 30_000 }).toBe('600');

      // Changed on the wall: stored within a few seconds, without a refresh.
      await wall.waitForLoadState('load');
      await wall.evaluate(() => localStorage.setItem('prism-screensaver-drift', 'off'));
      await expect.poll(async () => (await stored())?.settings?.['prism-screensaver-drift'], { timeout: 30_000 }).toBe('off');

      // The phone picks the wall's dashboard; the wall's home page opens on it.
      const created = await phone.request.post('/api/layouts', {
        data: { name: `Hall board ${tag}`, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }] },
      });
      const board = await created.json();
      await phone.reload();
      await phone.getByLabel(`Dashboard for ${HALL}`).selectOption({ label: `Hall board ${tag}` });
      await expect.poll(async () => (await stored())?.dashboardId).toBe(board.id);
      await wall.goto('/');
      await expect(wall).toHaveURL(new RegExp(`/d/${board.slug}$`));

      // A reset browser on the same wall takes the screen back, settings and all.
      const fresh = await openDisplays(resetContext, parent.name);
      await fresh.getByLabel('Existing screen').selectOption({ label: HALL });
      await fresh.getByRole('button', { name: 'Use its name and settings' }).click();
      await expect.poll(() => readStorage(fresh, TIMEOUT), { timeout: 30_000 }).toBe('600');
      await expect(fresh.getByText('This screen is named')).toContainText(HALL, { timeout: 30_000 });

      await phone.request.delete(`/api/displays/${hall.id}`);
      await phone.request.delete(`/api/layouts/${board.id}`);
    } finally {
      await wallContext.close();
      await phoneContext.close();
      await resetContext.close();
    }
  });
});

test.describe('Another screen\'s settings', () => {
  test('changed from a phone in Settings > Displays, and the screen uses them', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(180_000);
    const tag = Date.now().toString(36);
    const DEN = `Den ${tag}`;

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const phoneContext = await browser.newContext();
    try {
      const wall = await openDisplays(wallContext, parent.name);
      await wall.getByLabel('Name for this screen').fill(DEN);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText(DEN);
      // A screen's own settings are on its own pages, not in its row.
      await expect(wall.getByTestId('display-row').filter({ hasText: DEN })
        .getByRole('button', { name: 'Settings' })).toHaveCount(0);

      const phone = await openDisplays(phoneContext, parent.name);
      await phone.getByTestId('display-row').filter({ hasText: DEN })
        .getByRole('button', { name: 'Settings' }).click();
      const panel = phone.getByTestId('screen-settings');
      await panel.getByLabel(`Activate after on ${DEN}`).selectOption({ label: '1 hour' });
      await expect(panel).toContainText(`Saved. ${DEN} changes within a minute.`);
      // Only shown once there is an effect to time.
      await expect(panel.getByLabel(`Change every on ${DEN}`)).toHaveCount(0);
      await panel.getByLabel(`Widget transition effect on ${DEN}`).selectOption({ label: 'Smoke' });
      await expect(panel.getByLabel(`Change every on ${DEN}`)).toBeVisible();
      await panel.getByLabel(`Drift on ${DEN}`).selectOption({ label: 'Off' });
      await panel.getByLabel(`On-screen keyboard on ${DEN}`).selectOption({ label: 'Never' });
      await expect(panel.getByLabel(`On-screen keyboard on ${DEN}`)).toHaveValue('"never"');

      // On the screen: stored as its own controls store them, and shown there.
      await wall.reload();
      await expect.poll(() => readStorage(wall, 'prism-screensaver-timeout'), { timeout: 30_000 }).toBe('3600');
      expect(await readStorage(wall, 'prism-screensaver-motion')).toBe('smoke');
      expect(await readStorage(wall, 'prism-screensaver-motion-v2')).toBe('1');
      expect(await readStorage(wall, 'prism-screensaver-drift')).toBe('off');
      expect(await readStorage(wall, 'prism:keyboard-on-this-device')).toBe('"never"');
      await wall.goto('/settings?section=display');
      const screensaver = wall.locator('#screensaver-settings');
      await expect(screensaver.locator('select').first()).toHaveValue('3600', { timeout: 30_000 });
      await expect(screensaver.getByRole('checkbox', { name: 'Drift' })).not.toBeChecked();

      const { displays } = await (await phone.request.get('/api/displays')).json();
      const den = displays.find((d: { name: string }) => d.name === DEN);
      await phone.request.delete(`/api/displays/${den.id}`);
    } finally {
      await wallContext.close();
      await phoneContext.close();
    }
  });
});

/** `HH:mm` on the wall clock in `timeZone` at `at`. */
function wallTime(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

test.describe('Time-of-day layouts', () => {
  test('a scheduled dashboard takes over when its time starts, once the screen is left alone, without a reload', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(180_000);
    const tag = Date.now().toString(36);
    const PORCH = `Porch ${tag}`;
    const MORNING = `Morning ${tag}`;
    const ZONE = 'America/Chicago';

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext({ timezoneId: ZONE });
    try {
      const wall = await wallContext.newPage();
      await verifySettingsPinViaAPI(wall, parent.name);
      const settings = await (await wall.request.get('/api/settings')).json();
      const zone: string = settings?.settings?.timezone || ZONE;

      // Morning is the default dashboard with the clock and weather swapped
      // and the shopping list left off.
      const { layouts } = await (await wall.request.get('/api/layouts')).json() as { layouts: Array<{ isDefault: boolean; widgets: Array<{ i: string; x: number; y: number; w: number; h: number }> }> };
      const home = layouts.find((l) => l.isDefault)!;
      const at = (id: string) => home.widgets.find((w) => w.i === id)!;
      const [clock, weather] = [at('clock'), at('weather')];
      const morningWidgets = home.widgets
        .filter((w) => w.i !== 'shopping')
        .map((w) => w.i === 'clock' ? { ...w, x: weather.x, y: weather.y, w: weather.w, h: weather.h }
          : w.i === 'weather' ? { ...w, x: clock.x, y: clock.y, w: clock.w, h: clock.h } : w);
      const morning = await (await wall.request.post('/api/layouts', { data: { name: MORNING, widgets: morningWidgets } })).json();

      // Name the wall, and give it a schedule from its own Displays page: from
      // a moment half a day away, so the server's real clock never falls in it.
      const start = Math.ceil((Date.now() + 12 * 3600_000) / 60_000) * 60_000;
      await wall.goto('/settings?section=displays');
      await wall.getByLabel('Name for this screen').fill(PORCH);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      const row = wall.getByTestId('display-row').filter({ hasText: PORCH });
      await row.getByRole('button', { name: 'Schedule' }).click();
      const panel = wall.getByTestId('screen-schedule');
      await panel.getByRole('button', { name: 'Add a time' }).click();
      await panel.getByLabel('Dashboard for time 1').selectOption({ label: MORNING });
      await panel.getByLabel('Start of time 1').fill(wallTime(start, zone));
      await panel.getByLabel('End of time 1').fill(wallTime(start + 3600_000, zone));
      const days = panel.getByRole('group', { name: 'Days for time 1' });
      for (const day of ['Sunday', 'Saturday']) await days.getByRole('button', { name: day }).click();
      await panel.getByRole('button', { name: 'Save schedule' }).click();
      await expect(panel).toContainText(`Saved. ${PORCH} follows it within a minute.`);
      await expect.poll(() => readStorage(wall, 'prism-screen-schedule')).toContain(morning.id);

      // The wall's clock, ninety seconds before the window. Drift off, so an
      // idle screen's widgets stand still to be measured.
      await wall.evaluate(() => localStorage.setItem('prism-screensaver-drift', 'off'));
      await wall.clock.install({ time: start - 90_000 });
      await wall.goto('/');
      const cell = (id: string) => wall.locator(`[data-widget="${id}"]`);
      await expect(cell('shopping')).toBeVisible({ timeout: 60_000 });
      const before = await cell('clock').boundingBox();
      const weatherBefore = await cell('weather').boundingBox();
      await wall.evaluate(() => {
        (window as unknown as { stayedLoaded: boolean }).stayedLoaded = true;
        // Every view transition's animated parts, to see the widgets morph.
        const start = document.startViewTransition.bind(document);
        const seen: string[] = [];
        (window as unknown as { morphs: string[] }).morphs = seen;
        document.startViewTransition = (arg) => {
          const t = start(arg);
          t.ready.then(() => {
            for (const a of document.getAnimations()) {
              const p = (a.effect as KeyframeEffect | null)?.pseudoElement;
              if (p) seen.push(p);
            }
          }, () => {});
          return t;
        };
      });

      // Someone touches the screen half a minute before; the window starts
      // but the dashboard stays while the touch is under a minute old. The
      // clock stands still between jumps, so each is exact.
      await wall.clock.pauseAt(start - 30_000);
      await wall.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown')));
      await wall.clock.fastForward(40_000);
      await wall.waitForTimeout(1_000);
      await expect(cell('shopping')).toBeVisible();

      // Left alone for the minute: Morning, in place.
      await wall.clock.fastForward(30_000);
      await wall.clock.resume();
      await expect(cell('shopping')).toHaveCount(0, { timeout: 10_000 });
      await expect(wall).toHaveURL(/\/$/);
      expect(await wall.evaluate(() => (window as unknown as { stayedLoaded?: boolean }).stayedLoaded)).toBe(true);
      // The clock moved to where the weather was, by sliding there.
      await wall.waitForTimeout(2_000);
      const after = await cell('clock').boundingBox();
      expect(Math.abs(after!.x - weatherBefore!.x)).toBeLessThan(2);
      expect(Math.abs(after!.y - weatherBefore!.y)).toBeLessThan(2);
      expect(Math.abs(after!.x - before!.x) + Math.abs(after!.y - before!.y)).toBeGreaterThan(20);
      const morphs = await wall.evaluate(() => (window as unknown as { morphs: string[] }).morphs);
      expect(morphs).toContain('::view-transition-group(widget-clock)');

      const { displays } = await (await wall.request.get('/api/displays')).json();
      const porch = displays.find((d: { name: string }) => d.name === PORCH);

      // Loaded inside a window, the home page opens the scheduled dashboard
      // straight away. The server's clock is real, so the window is now.
      const now = Date.now();
      const rule = { days: [0, 1, 2, 3, 4, 5, 6], from: wallTime(now - 120_000, zone), to: wallTime(now + 3600_000, zone), dashboardId: morning.id };
      await wall.request.patch(`/api/displays/${porch.id}`, { data: { settings: { 'prism-screen-schedule': JSON.stringify([rule]) } } });
      const opened = await wall.request.get('/', { maxRedirects: 0 });
      expect(opened.status()).toBe(307);
      expect(opened.headers().location).toBe(`/d/${morning.slug}`);

      await wall.request.delete(`/api/displays/${porch.id}`);
      await wall.request.delete(`/api/layouts/${morning.id}`);
    } finally {
      await wallContext.close();
    }
  });
});

test.describe('Attention notices', () => {
  test('turned on in Settings > Displays, new messages show as cards at the top right, newest first, and keep coming while idle', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(120_000);
    const tag = Date.now().toString(36);
    const HALL = `Hall ${tag}`;

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const posted: string[] = [];
    try {
      const wall = await wallContext.newPage();
      await verifySettingsPinViaAPI(wall, parent.name);
      // Signed in, the family list carries ids.
      const author = await getFirstParent(wall);
      await wall.goto('/settings?section=displays');
      await wall.getByLabel('Name for this screen').fill(HALL);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      const row = wall.getByTestId('display-row').filter({ hasText: HALL });
      await row.getByRole('button', { name: 'Notices' }).click();
      const panel = wall.getByTestId('screen-attention');
      await panel.getByLabel('A message was posted in the last', { exact: true }).check();
      await panel.getByRole('button', { name: 'Save notices' }).click();
      await expect(panel).toContainText(`Saved. ${HALL} follows it within a minute.`);
      await expect.poll(() => readStorage(wall, 'prism-screen-attention')).toBe('{"message":120}');
      // Off the dashboard, nothing shows.
      await expect(wall.getByTestId('attention-panel')).toHaveCount(0);

      for (const text of [`First ${tag}`, `Second ${tag}`]) {
        const res = await wall.request.post('/api/messages', { data: { message: text, authorId: author.id } });
        expect(res.status()).toBe(201);
        posted.push((await res.json()).id);
        await wall.waitForTimeout(1_100);
      }

      // A controllable clock, to run the message polling forward while idle.
      await wall.clock.install();
      await wall.goto('/');
      const notices = wall.getByTestId('attention-notice').filter({ hasText: tag });
      await expect(notices).toHaveCount(2, { timeout: 30_000 });
      await expect(notices.nth(0)).toContainText(`Second ${tag}`);
      await expect(notices.nth(1)).toContainText(`First ${tag}`);

      // A narrow column hugging the top right corner, cards as tall as their text.
      const box = await wall.getByTestId('attention-panel').evaluate((el) => el.getBoundingClientRect().toJSON());
      const rem = await wall.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(1600 - box.right).toBeCloseTo(rem, 0);
      expect(box.top).toBeCloseTo(rem, 0);
      expect(box.width).toBeLessThanOrEqual(400);
      const card = await notices.nth(0).evaluate((el) => el.getBoundingClientRect().height);
      expect(card).toBeLessThan(160);

      await notices.nth(0).getByRole('button', { name: 'Dismiss' }).click();
      await expect(notices).toHaveCount(1);
      await expect(notices.nth(0)).toContainText(`First ${tag}`);

      // Average brightness (0-255) of a card's background, whatever colour syntax it uses.
      const brightness = () => notices.nth(0).evaluate((el) => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = getComputedStyle(el).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return (r! + g! + b!) / 3;
      });
      expect(await brightness()).toBeGreaterThan(200);

      // The screensaver comes up: the cards stay on top of it, turn dark, and
      // a message posted while idle still arrives.
      await wall.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await expect(wall.getByTestId('attention-panel')).toHaveAttribute('data-idle', 'true');
      await expect.poll(brightness, { timeout: 5_000 }).toBeLessThan(60);
      const res = await wall.request.post('/api/messages', { data: { message: `Third ${tag}`, authorId: author.id } });
      expect(res.status()).toBe(201);
      posted.push((await res.json()).id);
      // Within the panel's own half-minute check, well before the widgets' two.
      await wall.clock.fastForward('00:40');
      await expect(notices.nth(0)).toContainText(`Third ${tag}`, { timeout: 15_000 });

      const { displays } = await (await wall.request.get('/api/displays')).json();
      const hall = displays.find((d: { name: string }) => d.name === HALL);
      await wall.request.delete(`/api/displays/${hall.id}`);
    } finally {
      const cleanup = await wallContext.newPage().catch(() => null);
      for (const id of posted) await cleanup?.request.delete(`/api/messages/${id}`).catch(() => {});
      await wallContext.close();
    }
  });
});
