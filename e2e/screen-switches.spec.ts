import { test, expect, type Browser, type Page } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * A screen shows one dashboard and switches to another for a while (#1282):
 * at bus time, from 30 minutes before a bus route's time at the stop to 15
 * after unless the switch has routes and minutes of its own (#1291), or at
 * set times. Through the day shows them as rows in the screen's
 * editor, kept there until Done; Settings > Screens picks the dashboard on the
 * screen's row. The home page opens a named screen on the dashboard it shows
 * now, a switch's included.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

type Switch = { when: 'bus'; dashboardId: string; routeIds?: string[]; before?: number; after?: number }
  | { when: 'times'; days: number[]; from: string; to: string; dashboardId: string };
type Screen = { id: string; name: string; dashboardId: string | null; switches: Switch[] };

async function signIn(page: Page) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
}
async function addDashboard(page: Page, name: string): Promise<{ id: string; slug: string }> {
  const res = await page.request.post('/api/layouts', { data: { name, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }] } });
  expect(res.ok()).toBe(true);
  return res.json();
}
async function screens(page: Page): Promise<Screen[]> {
  return (await (await page.request.get('/api/displays')).json()).displays;
}

/** "HH:mm" on the household's wall clock at `at`. */
function wallTime(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

const rows = (page: Page) => page.locator('[data-editor-sheet="day"] [data-switch-row]');

/**
 * A screen named from a browser of its own, with `plan` set, and a laptop
 * signed in to edit it.
 */
async function namedScreen(browser: Browser, name: string, plan: Partial<Pick<Screen, 'dashboardId' | 'switches'>> = {}) {
  const probe = await browser.newPage();
  const parent = await getFirstParent(probe);
  await probe.close();
  const wallContext = await browser.newContext();
  const wall = await wallContext.newPage();
  await verifySettingsPinViaAPI(wall, parent.name);
  const named = await wall.request.post('/api/displays', { data: { name } });
  expect(named.ok()).toBe(true);
  const id: string = (await named.json()).display?.id ?? (await (await wall.request.get('/api/displays')).json()).currentId;
  if (Object.keys(plan).length > 0) expect((await wall.request.patch(`/api/displays/${id}`, { data: plan })).ok()).toBe(true);
  return {
    id,
    wall,
    /** A laptop of the given kind, signed in, on the screen's editor with Through the day open. */
    edit: async (options: { hasTouch?: boolean } = {}) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
      const page = await context.newPage();
      await signIn(page);
      await verifySettingsPinViaAPI(page, parent.name);
      await page.goto(`/screens/${id}`);
      await page.locator('[data-editor-open="day"]').click({ timeout: 90_000 });
      return { page, close: () => context.close() };
    },
    remove: async () => { await wall.request.delete(`/api/displays/${id}`); await wallContext.close(); },
  };
}

test.describe('a screen\'s dashboard and switches (#1282)', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(240_000);

  test('a screen with a bus switch opens on the bus dashboard at bus time, and on its own outside it', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    const settings = await (await setup.request.get('/api/settings')).json();
    const zone: string = settings?.settings?.timezone || 'America/Chicago';
    // A route due at the stop in ten minutes, every day.
    const soon = wallTime(Date.now() + 10 * 60_000, zone);
    test.skip(soon < wallTime(Date.now(), zone), 'the window would run past midnight');
    const kitchen = await addDashboard(setup, `Kitchen ${tag}`);
    const school = await addDashboard(setup, `School run ${tag}`);
    const created = await setup.request.post('/api/bus-tracking/routes', { data: {
      studentName: 'Sam', tripId: `e2e-${tag}`, direction: 'AM', label: `Morning ${tag}`,
      scheduledTime: soon, activeDays: [0, 1, 2, 3, 4, 5, 6],
    } });
    expect(created.ok(), await created.text()).toBe(true);
    const route = await created.json();
    const routeId: string = route.route?.id ?? route.id;
    const screen = await namedScreen(browser, `Kitchen ${tag}`, { dashboardId: kitchen.id, switches: [{ when: 'bus', dashboardId: school.id }] });
    try {
      const opensOn = async () => {
        const res = await screen.wall.request.get('/', { maxRedirects: 0 });
        expect(res.status()).toBe(307);
        return res.headers().location;
      };
      const switchTo = async (bus: Partial<Extract<Switch, { when: 'bus' }>>) => expect((await screen.wall.request.patch(
        `/api/displays/${screen.id}`, { data: { switches: [{ when: 'bus', dashboardId: school.id, ...bus }] } },
      )).ok()).toBe(true);

      // Within 30 minutes of the route: the bus dashboard.
      expect(await opensOn()).toBe(`/d/${school.slug}`);
      // A switch that starts 5 minutes before the bus: not yet (#1291).
      await switchTo({ before: 5 });
      expect(await opensOn()).toBe(`/d/${kitchen.slug}`);
      // One that follows only another route: not this one's time either.
      await switchTo({ routeIds: ['00000000-0000-4000-8000-000000000000'] });
      expect(await opensOn()).toBe(`/d/${kitchen.slug}`);
      // One that follows this route, 30 minutes before: the bus dashboard.
      await switchTo({ routeIds: [routeId], before: 30 });
      expect(await opensOn()).toBe(`/d/${school.slug}`);

      // The route moves to three hours away: its own dashboard again.
      expect((await setup.request.patch(`/api/bus-tracking/routes/${routeId}`, { data: { scheduledTime: wallTime(Date.now() + 3 * 3600_000, zone) } })).ok()).toBe(true);
      const outside = await screen.wall.request.get('/', { maxRedirects: 0 });
      expect(outside.status()).toBe(307);
      expect(outside.headers().location).toBe(`/d/${kitchen.slug}`);
    } finally {
      await screen.remove();
      await setup.request.delete(`/api/bus-tracking/routes/${routeId}`);
      await setup.request.delete(`/api/layouts/${school.id}`);
      await setup.request.delete(`/api/layouts/${kitchen.id}`);
      await setup.close();
    }
  });

  test('in the screen\'s editor its switches are rows; Done sends them to the screen and Cancel does not', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    const kitchen = await addDashboard(setup, `Kitchen ${tag}`);
    const school = await addDashboard(setup, `School run ${tag}`);
    const screen = await namedScreen(browser, `Hall ${tag}`, { dashboardId: kitchen.id });
    const stored = async () => (await screens(setup)).find((d) => d.id === screen.id)!;
    let laptop = await screen.edit();
    try {
      let page = laptop.page;
      let sheet = page.locator('[data-editor-sheet="day"]');
      await expect(sheet.getByLabel('Dashboard this screen shows')).toHaveValue(kitchen.id);
      await expect(sheet.locator('[data-timeline-bar]')).toHaveCount(0);

      // A bus switch and a set-times one, then Cancel: nothing reaches the screen.
      await sheet.locator('[data-switch-add="bus"]').click();
      await rows(page).first().getByLabel('Switches to').selectOption({ label: `School run ${tag}` });
      await sheet.locator('[data-switch-add="times"]').click();
      await expect(rows(page)).toHaveCount(2);
      // Another bus switch can be added, for another route (#1291).
      await expect(sheet.locator('[data-switch-add="bus"]')).toBeEnabled();
      expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth), 'nothing runs past the panel').toBeLessThanOrEqual(0);
      await page.locator('[data-editor-cancel]').click();
      await page.waitForURL(/\/settings/, { timeout: 60_000 });
      expect((await stored()).switches).toEqual([]);
      await laptop.close();

      // Again, and Done: the bus switch on the five weekdays' set times too.
      laptop = await screen.edit();
      page = laptop.page;
      sheet = page.locator('[data-editor-sheet="day"]');
      await sheet.locator('[data-switch-add="bus"]').click();
      await rows(page).first().getByLabel('Switches to').selectOption({ label: `School run ${tag}` });
      // From 10 minutes before the bus (#1291).
      await rows(page).first().getByLabel('Minutes before the bus').selectOption('10');
      await sheet.locator('[data-switch-add="times"]').click();
      const times = rows(page).nth(1);
      await times.getByLabel('Switch starts').fill('21:00');
      await times.getByLabel('Switch ends').fill('06:30');
      const days = times.getByRole('group', { name: 'Switch days' });
      await days.getByRole('button', { name: 'Saturday' }).click();
      await days.getByRole('button', { name: 'Sunday' }).click();
      // The Dashboard panel marks the one shown here.
      await page.locator('[data-editor-open="dashboard"]').click();
      await expect(page.locator(`[data-dashboard-row="${kitchen.id}"] [data-shown-here]`)).toHaveText('Shown here');
      await page.locator('[data-editor-done]').click();
      await expect.poll(async () => (await stored()).switches, { timeout: 30_000 }).toEqual([
        { when: 'bus', dashboardId: school.id, before: 10 },
        // A new switch starts on a dashboard other than the one it shows.
        { when: 'times', days: [1, 2, 3, 4, 5], from: '21:00', to: '06:30', dashboardId: expect.any(String) },
      ]);
      expect((await stored()).dashboardId).toBe(kitchen.id);
    } finally {
      await laptop.close();
      await screen.remove();
      await setup.request.delete(`/api/layouts/${school.id}`);
      await setup.request.delete(`/api/layouts/${kitchen.id}`);
      await setup.close();
    }
  });

  test('the Settings row\'s dropdown saves the screen\'s dashboard, and its line names the switches', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    const kitchen = await addDashboard(setup, `Kitchen ${tag}`);
    const school = await addDashboard(setup, `School run ${tag}`);
    const NAME = `Hall ${tag}`;
    const screen = await namedScreen(browser, NAME, { switches: [{ when: 'bus', dashboardId: school.id }] });
    try {
      const probe = await browser.newPage();
      const parent = await getFirstParent(probe);
      await probe.close();
      await verifySettingsPinViaAPI(setup, parent.name);
      await setup.goto('/settings?section=displays');
      const row = setup.getByTestId('display-row').filter({ hasText: NAME });
      await row.getByLabel(`Dashboard for ${NAME}`).selectOption({ label: `Kitchen ${tag}` });
      await expect.poll(async () => (await screens(setup)).find((d) => d.id === screen.id)?.dashboardId).toBe(kitchen.id);
      await expect(row.locator('[data-screen-summary]')).toContainText(`Shows Kitchen ${tag}, School run ${tag} at bus time, rests after`);
      // Edit opens the screen's own editor (#1267).
      await row.getByRole('link', { name: 'Edit' }).click();
      await expect(setup).toHaveURL(new RegExp(`/screens/${screen.id}$`), { timeout: 60_000 });
      await expect(setup.getByRole('heading', { level: 1 })).toContainText(NAME);
    } finally {
      await screen.remove();
      await setup.request.delete(`/api/layouts/${school.id}`);
      await setup.request.delete(`/api/layouts/${kitchen.id}`);
      await setup.close();
    }
  });

  test('with a mouse the panel\'s controls are sized for a desk, and a finger still gets 44px', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    const bus = await addDashboard(setup, `Sizes ${tag}`);
    const screen = await namedScreen(browser, `Sizes ${tag}`, { switches: [{ when: 'times', days: [1, 2, 3, 4, 5], from: '07:00', to: '07:45', dashboardId: bus.id }] });
    /** Heights (and widths) of the Through the day controls in the screen's editor. */
    const measure = async (touch: boolean) => {
      const { page, close } = await screen.edit({ hasTouch: touch });
      try {
        const sheet = page.locator('[data-editor-sheet="day"]');
        await expect(rows(page)).toHaveCount(1);
        const box = async (selector: string) => (await sheet.locator(selector).first().boundingBox())!;
        // The words on each kind of control: a day, + Switch, See it, More.
        const fonts = await sheet.evaluate((el) => ['[data-day-chip="1"]', '[data-switch-add="times"]', '[data-see="night"]', '[data-day-more]']
          .map((s) => `${s} ${getComputedStyle(el.querySelector(s)!).fontSize}`));
        // Each day bubble, and the tab bar: the Through the day tab's words,
        // and the ground the tabs are drawn on.
        const days = await sheet.locator('[data-day-chip]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
        const tabWords = (await page.locator('[data-editor-open="day"] span').last().boundingBox())!;
        const tabGround = await page.locator('[data-editor-panels] nav').evaluate((nav) => {
          const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
          for (let e: Element | null = nav; e; e = e.parentElement) {
            const [r = 0, g = 0, b = 0, a = 1] = rgba(getComputedStyle(e).backgroundColor);
            if (a > 0.5) return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          }
          return 1;
        });
        return { fonts, days, tabWords, tabGround, box: {
          day: await box('[data-day-chip="1"]'),
          add: await box('[data-switch-add="bus"]'),
          shows: await box('[data-screen-dashboard]'),
          resting: await box('[data-resting-look]'),
          night: await box('[data-night-look]'),
          see: await box('[data-see="night"]'),
          tab: (await page.locator('[data-editor-open="day"]').boundingBox())!,
          done: (await page.locator('[data-editor-done]').boundingBox())!,
        } };
      } finally {
        await close();
      }
    };

    try {
      // A mouse: controls 28 to 36px, so the panel does not outweigh the
      // canvas, and every control's words are one size.
      const { box: mouse, fonts, days, tabWords, tabGround } = await measure(false);
      expect(new Set(fonts.map((f) => f.split(' ').pop())).size, fonts.join('; ')).toBe(1);
      for (const [name, b] of Object.entries(mouse)) {
        if (name === 'tab') continue;
        expect(b.height, `${name} with a mouse`).toBeGreaterThanOrEqual(28);
        expect(b.height, `${name} with a mouse`).toBeLessThanOrEqual(36);
      }
      // A switch's seven days on one row, all one width, wide enough for Mon and Wed.
      expect(days).toHaveLength(7);
      expect(new Set(days.map((d) => Math.round(d.top))).size, 'one row').toBe(1);
      expect(Math.max(...days.map((d) => d.width)) - Math.min(...days.map((d) => d.width)), 'one width').toBeLessThanOrEqual(0.5);
      expect(days[0]!.width).toBeGreaterThanOrEqual(40);
      // The menu as a desktop page has it: Done above the tabs, the tabs on the
      // light panel rather than a dark slab, each label one line.
      expect(mouse.tab.height).toBeLessThanOrEqual(48);
      expect(mouse.done.y + mouse.done.height).toBeLessThanOrEqual(mouse.tab.y);
      expect(tabGround, 'the tabs\' ground is light').toBeGreaterThan(0.5);
      expect(tabWords.height, 'Through the day on one line').toBeLessThanOrEqual(20);

      // A finger: every one of them a 44px target.
      const { box: finger } = await measure(true);
      for (const [name, b] of Object.entries(finger)) {
        expect(b.height, `${name} by touch`).toBeGreaterThanOrEqual(44);
      }
      expect(finger.day.width).toBeGreaterThanOrEqual(44);
    } finally {
      await screen.remove();
      await setup.request.delete(`/api/layouts/${bus.id}`);
      await setup.close();
    }
  });

});
