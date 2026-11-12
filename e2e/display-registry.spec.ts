/**
 * Display registry (#690): a screen is named from itself, and every other
 * device sees it, can rename it, and can remove it.
 *
 * Two browser contexts stand in for the wall screen and a parent's phone, so
 * the cookies are really separate: only the wall carries the display cookie.
 * Runs against a fresh-seeded database only (it adds and removes a row).
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';
import { deleteLayout } from './helpers/cleanup';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

async function openDisplays(context: BrowserContext, parentName: string): Promise<Page> {
  const page = await context.newPage();
  await verifySettingsPinViaAPI(page, parentName);
  await page.goto('/settings?section=displays');
  await expect(page.getByRole('heading', { name: 'Screens', level: 2 })).toBeVisible();
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
      const picked = await phone.request.patch(`/api/displays/${hall.id}`, { data: { dashboardId: board.id } });
      expect(picked.ok()).toBe(true);
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

test.describe('Editing a screen from a phone', () => {
  test('the phone shows the screen at its own shape, the screen says it is being edited, and changes after Done', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(240_000);
    const tag = Date.now().toString(36);
    const DEN = `Den ${tag}`;
    const WALL = { width: 1280, height: 800 };

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext({ viewport: WALL });
    const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    try {
      const wall = await openDisplays(wallContext, parent.name);
      await wall.getByLabel('Name for this screen').fill(DEN);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText(DEN);
      await wall.goto('/');

      const phone = await openDisplays(phoneContext, parent.name);
      const den = async () => {
        const { displays } = await (await phone.request.get('/api/displays')).json();
        return displays.find((d: { name: string }) => d.name === DEN);
      };
      // The wall reports its size with its heartbeat.
      await expect.poll(async () => { const d = await den(); return d && [d.width, d.height]; }, { timeout: 30_000 })
        .toEqual([WALL.width, WALL.height]);

      // Its own dashboard, so Done saves that one and not the household's
      // default, which the screensaver specs that follow rely on.
      const created = await phone.request.post('/api/layouts', {
        data: { name: `Den board ${tag}`, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }] },
      });
      const board = await created.json();
      expect((await phone.request.patch(`/api/displays/${(await den()).id}`, { data: { dashboardId: board.id } })).ok()).toBe(true);
      // The wall syncs, sees its new dashboard and goes to it once; let it settle there.
      await wall.goto('/');
      await expect.poll(async () => (await readStorage(wall, 'prism:display-sync-base')) ?? '', { timeout: 30_000 }).toContain(board.id);
      await expect.poll(() => wall.url(), { timeout: 30_000 }).toContain(`/d/${board.slug}`);
      await wall.waitForTimeout(3_000);
      await wall.waitForLoadState('load');

      // The row: what it shows and how it rests, and one Edit.
      await phone.reload();
      await expect(phone.getByTestId('display-row').filter({ hasText: DEN }).locator('[data-screen-summary]')).toContainText(`Shows Den board ${tag}`);
      const row = phone.getByTestId('display-row').filter({ hasText: DEN });
      await expect(row.locator('[data-screen-summary]')).toContainText('Rests after 2 min');
      await expect(row.getByRole('button', { name: 'Settings' })).toHaveCount(0);
      await row.getByRole('link', { name: 'Edit' }).click();
      await expect(phone).toHaveURL(/\/screens\//, { timeout: 60_000 });

      // A live picture at the wall's own shape, its dashboard laid out at the wall's size.
      const picture = phone.locator('[data-remote-picture]');
      await expect(picture).toBeVisible({ timeout: 60_000 });
      const box = await picture.evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(box.width / box.height).toBeCloseTo(WALL.width / WALL.height, 1);
      expect(box.width).toBeLessThanOrEqual(390);
      const frame = (await (await phone.locator('[data-remote-frame]').elementHandle())!.contentFrame())!;
      await expect.poll(() => frame.evaluate(() => [window.innerWidth, window.innerHeight]), { timeout: 30_000 })
        .toEqual([WALL.width, WALL.height]);

      // The editing bar is on the phone, at the phone's size, inside its width.
      const bar = phone.locator('[data-remote-edit-root] nav[aria-label="Edit"]');
      await expect(bar).toBeVisible({ timeout: 60_000 });
      const barBox = await bar.evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(barBox.left).toBeGreaterThanOrEqual(0);
      expect(barBox.right).toBeLessThanOrEqual(390);

      // The wall says so.
      await wall.reload();
      await expect(wall.locator('[data-remote-editing-note]')).toHaveText('Being edited from a phone', { timeout: 30_000 });

      // Change how long until it rests and its keyboard, then Done.
      await phone.locator('[data-editor-open="day"]').click();
      // An open sheet stops short of the picture, so the change can be watched.
      const sheet = await phone.locator('[data-editor-sheet]').evaluate((el) => el.getBoundingClientRect().toJSON());
      const shown = await picture.evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(sheet.top).toBeGreaterThanOrEqual(shown.bottom);
      // Rest after is in the resting stretch's card on the line (#1170).
      await phone.locator('[data-day-stretch="resting"]').first().click();
      await phone.getByLabel('Rest after').selectOption({ label: '1 hour' });
      await phone.locator('[data-editor-open="look"]').click();
      await phone.locator('[data-screen-options]').getByLabel('On-screen keyboard').selectOption({ label: 'Never' });
      // Nothing changed on the phone itself.
      expect(await readStorage(phone, 'prism-screensaver-timeout')).toBeNull();
      await phone.locator('[data-remote-edit-root] [data-editor-done]').click();
      await expect(phone.locator('[data-screen-saved]')).toContainText(`Saved. ${DEN} shows the change in a few seconds.`, { timeout: 30_000 });

      // The wall has it within a few seconds, and the note is gone.
      await expect.poll(() => readStorage(wall, 'prism-screensaver-timeout'), { timeout: 30_000 }).toBe('3600');
      expect(await readStorage(wall, 'prism:keyboard-on-this-device')).toBe('"never"');
      await expect(wall.locator('[data-remote-editing-note]')).toHaveCount(0, { timeout: 30_000 });
      expect(await readStorage(phone, 'prism-screensaver-timeout')).toBeNull();
      expect(await readStorage(phone, 'prism:keyboard-on-this-device')).toBeNull();

      await phone.request.delete(`/api/displays/${(await den()).id}`);
      await phone.request.delete(`/api/layouts/${board.id}`);
    } finally {
      await wallContext.close();
      await phoneContext.close();
    }
  });
});

/** `HH:mm` on the wall clock in `timeZone` at `at`. */
/** The zone's offset from UTC at a moment, as Intl names it ("GMT-5"). */
function zoneOffset(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')!.value;
}

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
      let start = Math.ceil((Date.now() + 12 * 3600_000) / 60_000) * 60_000;
      // Not near a clock change: in the hour that repeats when the clocks go
      // back, an hour later reads the same on the wall, and a window that
      // starts and ends at the same time is all day.
      const steady = (t: number) => [t - 2 * 3600_000, t + 3600_000].every((u) => zoneOffset(u, zone) === zoneOffset(t, zone));
      while (!steady(start)) start += 3600_000;
      await wall.goto('/settings?section=displays');
      await wall.getByLabel('Name for this screen').fill(PORCH);
      await wall.getByRole('button', { name: 'Name this display' }).click();
      await expect(wall.getByText('This screen is named')).toContainText(PORCH);
      // Interludes are on the screen's editing bar, on the Through the day
      // line: + Interlude adds one and opens its card (#1170).
      await wall.goto('/?edit=1');
      await wall.locator('[data-editor-open="day"]').click({ timeout: 60_000 });
      const sheet = wall.locator('[data-editor-sheet="day"]');
      await sheet.locator('[data-interlude-add]').click();
      const card = sheet.locator('[data-day-card="interlude"]');
      await card.getByLabel('Interlude dashboard').selectOption({ label: MORNING });
      await card.getByLabel('Interlude starts').fill(wallTime(start, zone));
      await card.getByLabel('Interlude ends').fill(wallTime(start + 3600_000, zone));
      // Every day, so the window half a day away is covered whichever day it falls on.
      const days = card.getByRole('group', { name: 'Interlude days' });
      for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
        const button = days.getByRole('button', { name: day });
        if (await button.getAttribute('aria-pressed') === 'false') await button.click();
      }
      await expect(days.locator('[aria-pressed="true"]')).toHaveCount(7);
      await expect(card).toContainText('Kept.');
      await expect.poll(() => readStorage(wall, 'prism-screen-schedule')).toContain(morning.id);
      await wall.locator('[data-editor-cancel]').click();

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

      // On Today too (#1152): a screen whose own dashboard is Today still
      // opens the Interlude in force.
      const today = await (await wall.request.post('/api/layouts', { data: { name: `Today ${tag}`, widgets: home.widgets, view: 'today' } })).json();
      try {
        await wall.request.patch(`/api/displays/${porch.id}`, { data: { dashboardId: today.id } });
        const onToday = await wall.request.get('/', { maxRedirects: 0 });
        expect(onToday.status()).toBe(307);
        expect(onToday.headers().location).toBe(`/d/${morning.slug}`);
      } finally {
        await wall.request.patch(`/api/displays/${porch.id}`, { data: { dashboardId: null } });
        await deleteLayout(wall, today.id);
      }

      await wall.request.delete(`/api/displays/${porch.id}`);
      await wall.request.delete(`/api/layouts/${morning.id}`);
    } finally {
      await wallContext.close();
    }
  });
});

test.describe('Attention notices', () => {
  test('turned on in the editing bar More sheet, new messages show as cards at the top right, newest first, and keep coming while idle', async ({ browser }) => {
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
      await expect(wall.getByText('This screen is named')).toContainText(HALL);
      // Notices are on the screen's editing bar, under More.
      await wall.goto('/?edit=1');
      await wall.locator('[data-editor-open="more"]').click({ timeout: 60_000 });
      const panel = wall.getByTestId('screen-attention');
      await panel.getByLabel('A message was posted in the last', { exact: true }).check();
      await panel.getByRole('button', { name: 'Save notices' }).click();
      await expect(panel).toContainText('Saved. This screen shows them from now on.');
      await expect.poll(() => readStorage(wall, 'prism-screen-attention')).toBe('{"message":120}');
      await wall.locator('[data-editor-cancel]').click();
      await wall.goto('/settings?section=displays');
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

test.describe('Settings width', () => {
  // A 42rem cap on every settings section cut screen names in this list down
  // to one letter on a 1080p screen, beside an empty half of the page. In
  // portrait the section sidebar took a third of the width as well.
  test('screen names show in full: the section uses the width, and portrait swaps the sidebar for the dropdown', async ({ browser }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(120_000);
    const tag = Date.now().toString(36);
    const NAME = `Basement playroom ${tag}`;

    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    let id: string | undefined;
    try {
      const page = await openDisplays(context, parent.name);
      const made = await page.request.post('/api/displays', { data: { name: NAME } });
      expect(made.ok(), 'precondition: screen named').toBe(true);
      id = (await made.json()).display?.id;

      for (const viewport of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
        await page.setViewportSize(viewport);
        await page.reload();
        const row = page.getByTestId('display-row').filter({ hasText: NAME });
        await expect(row).toBeVisible({ timeout: 60_000 });
        const label = `${viewport.width}x${viewport.height}`;

        const name = row.getByText(NAME, { exact: true });
        const clipped = await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(clipped, `${label}: the screen name is cut off`).toBe(false);

        // The section fills its scroll area (less padding), not a narrow column.
        const fill = await page.getByRole('heading', { name: 'Screens', level: 2 }).evaluate((h) => {
          const card = h.closest('div.space-y-6') ?? h.parentElement!.parentElement!;
          const area = card.closest('.overflow-y-auto')!;
          return card.getBoundingClientRect().width / area.clientWidth;
        });
        expect(fill, `${label}: section width / available width`).toBeGreaterThan(0.9);

        const portrait = viewport.height > viewport.width;
        await expect(page.locator('#settings-section-select')).toBeVisible({ visible: portrait });
        await expect(page.getByRole('navigation').getByRole('button', { name: 'Screens' })).toBeVisible({ visible: !portrait });
      }
    } finally {
      if (id) await context.request.delete(`/api/displays/${id}`).catch(() => {});
      await context.close();
    }
  });
});

test.describe('Settings keeps what is for all screens', () => {
  test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
  test.setTimeout(120_000);
  const PIN = process.env.E2E_PIN || '1234';

  // #1159: one screen's settings left Appearance and Input for its editing bar,
  // and Away's timer is the household's.
  test('Appearance and Input keep only what is for all screens, and Away is set once (#1159)', async ({ page }) => {
    expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
    await verifySettingsPinViaAPI(page, (await getFirstParent(page)).name);
    await page.goto('/settings?section=display');
    const away = page.locator('[data-away-card]');
    await expect(away).toBeVisible({ timeout: 60_000 });

    for (const title of ['Screensaver', 'Timers & Auto-Activation', 'Screen Orientation']) {
      await expect(page.getByText(title, { exact: true }), `${title} is on the editing bar now`).toHaveCount(0);
    }
    for (const label of ['Activate after', 'Dim at night', 'Sign out after', 'Auto-Hide Navigation']) {
      await expect(page.getByText(label, { exact: true }), `${label} is on the editing bar now`).toHaveCount(0);
    }
    await expect(page.locator('[data-fold="performance"]')).toHaveCount(0);
    await expect(page.locator('[data-screen-settings-moved] a')).toHaveAttribute('href', '/settings?section=displays');

    // Away: says it is for all screens, and is kept for the household.
    await expect(away).toContainText('All screens');
    const select = away.getByLabel('Turn Away mode on after');
    await expect(select).toBeEnabled();
    await select.selectOption({ label: '2 days' });
    await expect.poll(async () => (await (await page.request.get('/api/away-mode')).json()).autoAfterHours).toBe(48);
    expect(await page.evaluate(() => localStorage.getItem('prism-away-mode-timeout'))).toBeNull();
    await page.reload();
    await expect(page.locator('[data-away-card]').getByLabel('Turn Away mode on after')).toHaveValue('48', { timeout: 60_000 });
    await page.locator('[data-away-card]').getByLabel('Turn Away mode on after').selectOption({ label: 'Never (only by hand)' });
    await expect.poll(async () => (await (await page.request.get('/api/away-mode')).json()).autoAfterHours).toBe(0);

    // Input: the household switch stays and says so; the one-screen choice is on Look.
    await page.goto('/settings?section=input');
    await expect(page.getByLabel('Enable on-screen keyboard')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/^All screens\. To choose Always or Never/)).toBeVisible();
    await expect(page.getByText('On-screen keyboard on this device')).toHaveCount(0);
  });
});
