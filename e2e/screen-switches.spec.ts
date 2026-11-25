import { test, expect, type Browser, type Page } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';
import { canvasShows } from './helpers/canvasEditor';

/**
 * A screen shows one dashboard and switches to another for a while (#1282):
 * at bus time, from 30 minutes before a bus route's time at the stop to 15
 * after unless the switch has routes and minutes of its own (#1291), or at
 * set times. The editor's Screen tab shows them as rows that fold to a line
 * each (#1294, #1326), kept there until Done; Through the day has a slider that
 * steps through the day and shows the screen then; Settings > Screens picks
 * the dashboard on the screen's row. The home page opens a named screen on
 * the dashboard it shows now, a switch's included.
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

const rows = (page: Page) => page.locator('[data-editor-sheet="screen"] [data-switch-row]');

/**
 * A screen named from a browser of its own, with `plan` set, and a laptop
 * signed in to edit it.
 */
async function namedScreen(browser: Browser, name: string, plan: Partial<Pick<Screen, 'dashboardId' | 'switches'>> & { settings?: Record<string, string> } = {}) {
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
    /** A laptop of the given kind, signed in, on the screen's editor with its Screen tab open (#1326). */
    edit: async (options: { hasTouch?: boolean } = {}) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
      const page = await context.newPage();
      await signIn(page);
      await verifySettingsPinViaAPI(page, parent.name);
      await page.goto(`/screens/${id}`);
      await page.locator('[data-editor-open="screen"]').click({ timeout: 90_000 });
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
      let sheet = page.locator('[data-editor-sheet="screen"]');
      // The tab says which screen it is (#1326).
      await expect(sheet.getByLabel('Screen', { exact: true })).toHaveValue(screen.id);
      await expect(sheet.getByLabel('Base dashboard')).toHaveValue(kitchen.id);
      // The pencil renames it in place: Esc keeps the name, Enter saves at
      // once, and the heading and the drop-down follow.
      await sheet.getByRole('button', { name: `Rename Hall ${tag}` }).click();
      await expect(sheet.getByLabel('Name of this screen')).toBeFocused();
      await sheet.getByLabel('Name of this screen').fill('Nope');
      await sheet.getByLabel('Name of this screen').press('Escape');
      await expect(sheet.getByLabel('Name of this screen')).toHaveCount(0);
      await sheet.getByRole('button', { name: `Rename Hall ${tag}` }).click();
      await sheet.getByLabel('Name of this screen').fill(`Front hall ${tag}`);
      await sheet.getByLabel('Name of this screen').press('Enter');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Editing Front hall ${tag}`);
      await expect(sheet.getByLabel('Screen', { exact: true }).locator(`option[value="${screen.id}"]`)).toHaveText(`Front hall ${tag}`);
      await expect.poll(async () => (await stored()).name).toBe(`Front hall ${tag}`);
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
      sheet = page.locator('[data-editor-sheet="screen"]');
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
    /** Heights (and widths) of the Screen and Through the day controls in the screen's editor. */
    const measure = async (touch: boolean) => {
      const { page, close } = await screen.edit({ hasTouch: touch });
      try {
        // The screen's switch, on Screen (#1326).
        const screenSheet = page.locator('[data-editor-sheet="screen"]');
        await expect(rows(page)).toHaveCount(1);
        const boxIn = (sheet: typeof screenSheet) => async (selector: string) => (await sheet.locator(selector).first().boundingBox())!;
        let box = boxIn(screenSheet);
        // Folded, a row is one button; opening the switch shows its days (#1294).
        const fold = await box('[data-switch-row="0"] [data-fold-toggle]');
        await rows(page).first().locator('[data-fold-toggle]').click();
        // The words on each kind of control: a day, + Switch, then More.
        const fontOf = (sheet: typeof screenSheet, selectors: string[]) => sheet.evaluate((el, list) => list
          .map((s) => `${s} ${getComputedStyle(el.querySelector(s)!).fontSize}`), selectors);
        const switchFonts = await fontOf(screenSheet, ['[data-day-chip="1"]', '[data-switch-add="times"]']);
        // Each day bubble.
        const days = await screenSheet.locator('[data-day-chip]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
        const switchBoxes = {
          day: await box('[data-day-chip="1"]'),
          add: await box('[data-switch-add="bus"]'),
          shows: await box('[data-screen-dashboard]'),
          fold,
        };
        // The dashboard's own rows, on Through the day.
        await page.locator('[data-editor-open="day"]').click();
        const sheet = page.locator('[data-editor-sheet="day"]');
        box = boxIn(sheet);
        const nightFold = await box('[data-night-row] [data-fold-toggle]');
        const fonts = [...switchFonts, ...await fontOf(sheet, ['[data-day-more]'])];
        // The tab bar: the Through the day tab's words, and the ground the tabs are drawn on.
        const tabWords = (await page.locator('[data-editor-open="day"] span').last().boundingBox())!;
        const tabGround = await page.locator('[data-editor-panels] nav').evaluate((nav) => {
          const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
          for (let e: Element | null = nav; e; e = e.parentElement) {
            const [r = 0, g = 0, b = 0, a = 1] = rgba(getComputedStyle(e).backgroundColor);
            if (a > 0.5) return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          }
          return 1;
        });
        const measured = {
          ...switchBoxes,
          resting: await box('[data-resting-look]'),
          step: await box('[data-day-step="next"]'),
          // The canvas's toggles (#1348), above the picture.
          toggle: (await page.locator('[data-canvas-above] [data-canvas-pick="idle"]').boundingBox())!,
          nightFold,
        };
        // Night opens on its own row.
        await sheet.locator('[data-night-row] [data-fold-toggle]').click();
        return { fonts, days, tabWords, tabGround, box: {
          ...measured,
          night: await box('[data-night-look]'),
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

  // #1294: Through the day's slider steps through the moments the screen
  // changes, and the canvas shows the screen then; the rows fold. A switch's
  // dot opens that switch on the Screen tab (#1326).
  test('the day slider: each dot at its time, a switch\'s dashboard and the night look on the canvas, and three folded switches fit a laptop', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    // The screen goes dark from 9 pm to 6:30 am (its own day, #1345); School
    // run has tasks where Kitchen has a clock.
    const kitchenRes = await setup.request.post('/api/layouts', { data: {
      name: `Kitchen ${tag}`, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }],
    } });
    expect(kitchenRes.ok()).toBe(true);
    const kitchen: { id: string; slug: string } = await kitchenRes.json();
    const schoolRes = await setup.request.post('/api/layouts', { data: { name: `School run ${tag}`, widgets: [{ i: 'tasks', x: 0, y: 0, w: 16, h: 12 }] } });
    expect(schoolRes.ok()).toBe(true);
    const school: { id: string; slug: string } = await schoolRes.json();
    const every = [0, 1, 2, 3, 4, 5, 6];
    const screen = await namedScreen(browser, `Hall ${tag}`, { dashboardId: kitchen.id, switches: [
      { when: 'times', days: every, from: '07:00', to: '08:00', dashboardId: school.id },
      { when: 'times', days: every, from: '15:00', to: '15:45', dashboardId: school.id },
      { when: 'times', days: every, from: '01:45', to: '02:45', dashboardId: school.id },
    ], settings: {
      'prism-screen-day': JSON.stringify({ day: 'dashboard', night: 'off', switch: { by: 'clock', from: '21:00', to: '06:30' }, nightLevel: 0 }),
    } });
    const laptop = await screen.edit();
    try {
      const { page } = laptop;
      const screenSheet = page.locator('[data-editor-sheet="screen"]');
      const sheet = page.locator('[data-editor-sheet="day"]');
      const frame = page.frameLocator('[data-remote-frame]');
      await expect(rows(page)).toHaveCount(3);

      // All folded on open, and each panel fits the laptop's height without scrolling.
      await expect(screenSheet.locator('[data-open="true"]')).toHaveCount(0);
      const fits = (s: typeof sheet) => s.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, bottom: el.getBoundingClientRect().bottom }));
      let fit = await fits(screenSheet);
      expect(fit.scroll, 'the folded Screen panel needs no scrolling').toBeLessThanOrEqual(fit.client + 1);
      expect(fit.bottom).toBeLessThanOrEqual(900 + 0.5);
      // The switches' colours on their folded rows, for the line's below.
      const rowColours = await screenSheet.evaluate((root) => [0, 1, 2]
        .map((i) => { const el = root.querySelector(`[data-switch-row="${i}"] [data-swatch]`); return el ? getComputedStyle(el).backgroundColor : null; }));
      await page.locator('[data-editor-open="day"]').click();
      await expect(sheet.locator('[data-open="true"]')).toHaveCount(0);
      fit = await fits(sheet);
      expect(fit.scroll, 'the folded panel needs no scrolling').toBeLessThanOrEqual(fit.client + 1);
      expect(fit.bottom).toBeLessThanOrEqual(900 + 0.5);

      // A dot for each switch's start and end, and night's, each at its time on
      // the line, and a tap on each reaches only its own (3 pm and 3:45 pm are
      // a few pixels apart).
      const g = await sheet.evaluate((root) => {
        const line = root.querySelector('[data-day-line]')!.getBoundingClientRect();
        return {
          line: line.toJSON() as DOMRect,
          dots: [...root.querySelectorAll<HTMLElement>('[data-waypoint]')].map((d) => {
            const b = root.querySelector(`[data-waypoint-dot="${d.dataset.minute}"]`)!.getBoundingClientRect();
            const hit = d.getBoundingClientRect();
            return { minute: Number(d.dataset.minute), x: b.left + b.width / 2, hitLeft: hit.left, hitRight: hit.right };
          }),
        };
      });
      expect(g.dots.map((d) => d.minute)).toEqual(expect.arrayContaining([105, 165, 390, 420, 480, 900, 945, 1260]));
      g.dots.forEach((d, i) => {
        expect(Math.abs(d.x - (g.line.left + (d.minute / 1440) * g.line.width)), `the dot at minute ${d.minute}`).toBeLessThanOrEqual(1);
        expect(d.hitLeft, `a tap at minute ${d.minute}'s dot is its own`).toBeLessThanOrEqual(d.x);
        expect(d.hitRight).toBeGreaterThanOrEqual(d.x);
        if (i > 0) expect(d.hitLeft, `minute ${d.minute}'s tap area is clear of the one before`).toBeGreaterThanOrEqual(g.dots[i - 1]!.hitRight - 0.5);
      });

      // Each switch's colour is the same on its folded row (on Screen) as on its
      // stretch of the line, differs from the next, and the first takes the theme's own hue.
      const colours = await sheet.evaluate((root) => {
        const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : null);
        const hue = (rgb: string) => {
          const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).map((n) => Number(n) / 255);
          const max = Math.max(r!, g!, b!); const min = Math.min(r!, g!, b!); const d = max - min;
          if (d === 0) return 0;
          const h = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
          return (h * 60 + 360) % 360;
        };
        const span = (i: number) => bg(root.querySelector(`[data-day-span="${i}"]`));
        return {
          spans: [0, 1, 2].map(span),
          firstHue: hue(span(0)!),
          primaryHue: Number(getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().split(/\s+/)[0]),
        };
      });
      expect(rowColours).toEqual(colours.spans);
      expect(new Set(rowColours).size, rowColours.join(' ')).toBe(3);
      for (const c of rowColours) expect(c).not.toBe('rgba(0, 0, 0, 0)');
      expect(Math.abs(colours.firstHue - colours.primaryHue), `${colours.firstHue} vs the theme's ${colours.primaryHue}`).toBeLessThanOrEqual(3);

      // ▶ steps to the next dot, and the canvas shows the screen then: from
      // now, whichever it is, then on to night.
      await sheet.locator('[data-day-step="next"]').click();
      await expect(sheet.locator('[data-day-sheet]')).toHaveAttribute('data-day-at', /\d+/);

      // Tapping 7 am: School run on the canvas, as it is saved, and its row
      // open on the Screen tab (#1326).
      await sheet.locator('[data-waypoint][data-minute="420"]').click();
      await expect(page.locator('[data-editor-sheet="screen"]')).toBeVisible();
      await expect(rows(page).first()).toHaveAttribute('data-open', 'true');
      await expect(rows(page).nth(1)).toHaveAttribute('data-open', 'false');
      await expect(frame.locator(`[data-canvas-preview="${school.id}"]`)).toBeVisible({ timeout: 30_000 });
      await expect(frame.locator('.widget-cell[data-widget="tasks"]')).toBeVisible();
      await expect(frame.locator('[data-editor-widget]')).toHaveCount(0);
      await expect(page.locator('[data-editor-resting="preview"]')).toContainText(`Showing School run ${tag} as it is saved`);
      // Back on Through the day.
      await page.locator('[data-editor-open="day"]').click();
      // 9 pm: Kitchen's night look, the screen off.
      await sheet.locator('[data-waypoint][data-minute="1260"]').click();
      await expect(sheet.locator('[data-day-sheet]')).toHaveAttribute('data-day-shows', 'night');
      await expect(frame.locator('[data-preview-night="off"]')).toHaveCount(1);
      await expect(sheet.locator('[data-night-row]')).toHaveAttribute('data-open', 'true');
      // ◀ steps back to the dot before: 3:45 pm, Kitchen again, being edited
      // (unless now falls between).
      const before = Math.max(...g.dots.map((d) => d.minute).filter((m) => m < 1260));
      await sheet.locator('[data-day-step="prev"]').click();
      await expect(sheet.locator('[data-day-sheet]')).toHaveAttribute('data-day-at', String(before));
      if (before === 945) {
        await expect(frame.locator('[data-canvas-preview]')).toHaveCount(0);
        await expect(frame.locator('[data-editor-widget="clock"]')).toBeVisible();
      }
      await sheet.locator('[data-waypoint][data-minute="1260"]').click();
      // In use by day, on the canvas's toggles (#1348).
      await canvasShows(page, 'in-use', 'day');
      await expect(frame.locator('[data-preview-night]')).toHaveCount(0);
      await expect(sheet.locator('[data-day-sheet]')).toHaveAttribute('data-day-shows', 'active');

      // Another panel edits Kitchen: the canvas leaves School run. (The 3 pm
      // dot opens its switch on Screen, which keeps it on the canvas.)
      await sheet.locator('[data-waypoint][data-minute="900"]').click();
      await expect(page.locator('[data-editor-sheet="screen"]')).toBeVisible();
      await expect(frame.locator(`[data-canvas-preview="${school.id}"]`)).toBeVisible();
      await page.locator('[data-editor-open="widgets"]').click();
      await expect(frame.locator('[data-canvas-preview]')).toHaveCount(0);
      await expect(frame.locator('[data-editor-widget="clock"]')).toBeVisible();
    } finally {
      await laptop.close();
      await screen.remove();
      await setup.request.delete(`/api/layouts/${school.id}`);
      await setup.request.delete(`/api/layouts/${kitchen.id}`);
      await setup.close();
    }
  });

});
