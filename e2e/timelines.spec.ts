import { test, expect, type Browser, type Page } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * Timelines (#1266): a screen picks a timeline from a dropdown, and the
 * timeline says which dashboard shows when. In a screen's editor, Through the
 * day shows them as rows (#1281): the dashboard it shows, and each switch at
 * set times with its days and hours. The last test reads the database
 * through the API: a duplicate goes its own way, and the screens on a
 * deleted timeline follow the household's first.
 *
 * Each test makes its own timelines and leaves the household's first alone.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

type Timeline = { id: string; name: string; position: number; dashboardId: string | null; placements: Array<{ days: number[]; from: string; to: string; dashboardId: string }>; idleBackground: unknown; screens: number };

async function signIn(page: Page) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } })).ok()).toBe(true);
}
async function list(page: Page): Promise<Timeline[]> {
  return (await (await page.request.get('/api/timelines')).json()).timelines;
}
async function addTimeline(page: Page, name: string, patch: Partial<Timeline> = {}): Promise<Timeline> {
  const res = await page.request.post('/api/timelines', { data: { name } });
  expect(res.status()).toBe(201);
  const { timeline } = await res.json();
  if (Object.keys(patch).length > 0) expect((await page.request.patch(`/api/timelines/${timeline.id}`, { data: patch })).ok()).toBe(true);
  return timeline;
}
async function addDashboard(page: Page, name: string): Promise<{ id: string; slug: string }> {
  const res = await page.request.post('/api/layouts', { data: { name, widgets: [{ i: 'clock', x: 0, y: 0, w: 16, h: 12 }] } });
  expect(res.ok()).toBe(true);
  return res.json();
}

/** A switch's row in Through the day (#1281). */
const rows = (page: Page) => page.locator('[data-editor-sheet="day"] [data-placement-row]');

/**
 * A screen named from a browser of its own, following `timelineId`, and a
 * laptop signed in to edit it. Through the day shows a timeline only in a
 * screen's editor (#1281).
 */
async function namedScreen(browser: Browser, name: string, timelineId: string) {
  const probe = await browser.newPage();
  const parent = await getFirstParent(probe);
  await probe.close();
  const wallContext = await browser.newContext();
  const wall = await wallContext.newPage();
  await verifySettingsPinViaAPI(wall, parent.name);
  const named = await wall.request.post('/api/displays', { data: { name } });
  expect(named.ok()).toBe(true);
  const id: string = (await named.json()).display?.id ?? (await (await wall.request.get('/api/displays')).json()).currentId;
  expect((await wall.request.patch(`/api/displays/${id}`, { data: { timelineId } })).ok()).toBe(true);
  return {
    id,
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

test.describe('timelines (#1266)', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(240_000);

  test('a switch at set times is a row: on weekdays it is kept as one placement on the five days', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    const board = await addDashboard(setup, `Line board ${tag}`);
    const bus = await addDashboard(setup, `Bus ${tag}`);
    const own = await addTimeline(setup, `School days ${tag}`, { dashboardId: board.id });
    const screen = await namedScreen(browser, `Hall ${tag}`, own.id);
    const laptop = await screen.edit();
    try {
      const page = laptop.page;
      const sheet = page.locator('[data-editor-sheet="day"]');
      await expect(sheet.getByLabel('Timeline', { exact: true })).toHaveValue(own.id);
      await expect(sheet.getByLabel('Dashboard this screen shows')).toHaveValue(board.id);
      await expect(rows(page)).toHaveCount(0);

      await sheet.locator('[data-placement-add]').click();
      await expect(rows(page)).toHaveCount(1);
      const row = rows(page).first();
      await row.getByLabel('Switches to').selectOption({ label: `Bus ${tag}` });
      await row.getByLabel('Switch starts').fill('07:00');
      await row.getByLabel('Switch ends').fill('07:45');
      const days = row.getByRole('group', { name: 'Switch days' });
      await days.getByRole('button', { name: 'Saturday' }).click();
      await days.getByRole('button', { name: 'Sunday' }).click();

      // Kept on the timeline as one placement on the five days.
      await expect.poll(async () => (await list(setup)).find((t) => t.id === own.id)!.placements.map((p) => [p.days, p.from, p.to, p.dashboardId]))
        .toEqual([[[1, 2, 3, 4, 5], '07:00', '07:45', bus.id]]);
      await expect(rows(page)).toHaveCount(1);
      await expect(days.locator('[aria-pressed="true"]')).toHaveCount(5);
      // The row stays inside the panel.
      expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    } finally {
      await laptop.close();
      await screen.remove();
      await setup.request.delete(`/api/timelines/${own.id}`);
      await setup.request.delete(`/api/layouts/${bus.id}`);
      await setup.request.delete(`/api/layouts/${board.id}`);
      await setup.close();
    }
  });

  test('with a mouse the panel\'s controls are sized for a desk, and a finger still gets 44px', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const setup = await browser.newPage();
    await signIn(setup);
    const bus = await addDashboard(setup, `Sizes ${tag}`);
    const own = await addTimeline(setup, `Sizes ${tag}`, { placements: [{ days: [1, 2, 3, 4, 5], from: '07:00', to: '07:45', dashboardId: bus.id }] });
    const screen = await namedScreen(browser, `Sizes ${tag}`, own.id);
    /** Heights (and widths) of the Through the day controls in the screen's editor. */
    const measure = async (touch: boolean) => {
      const { page, close } = await screen.edit({ hasTouch: touch });
      try {
        const sheet = page.locator('[data-editor-sheet="day"]');
        await expect(rows(page)).toHaveCount(1);
        const box = async (selector: string) => (await sheet.locator(selector).first().boundingBox())!;
        // The words on each kind of control: a day, + Switch, See it, More.
        const fonts = await sheet.evaluate((el) => ['[data-day-chip="1"]', '[data-placement-add]', '[data-see="night"]', '[data-day-more]']
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
          add: await box('[data-placement-add]'),
          select: await box('[data-timeline-select]'),
          menu: await box('[data-timeline-menu]'),
          shows: await box('[data-rest-of-day]'),
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
      // The timeline's own actions are one button on its dropdown's row.
      expect(Math.abs(mouse.menu.y + mouse.menu.height / 2 - (mouse.select.y + mouse.select.height / 2)), 'menu beside the dropdown').toBeLessThanOrEqual(1);
      expect(mouse.menu.x).toBeGreaterThan(mouse.select.x + mouse.select.width);
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
      await setup.request.delete(`/api/timelines/${own.id}`);
      await setup.request.delete(`/api/layouts/${bus.id}`);
      await setup.close();
    }
  });

  test('switching a screen\'s timeline from the dropdown changes its rows', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const NAME = `Hall ${tag}`;
    const probe = await browser.newPage();
    const parent = await getFirstParent(probe);
    await probe.close();

    const wallContext = await browser.newContext();
    const laptopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const laptop = await laptopContext.newPage();
    await signIn(laptop);
    const morning = await addDashboard(laptop, `Morning ${tag}`);
    const evening = await addDashboard(laptop, `Evening ${tag}`);
    const school = await addTimeline(laptop, `School ${tag}`, { placements: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '08:00', dashboardId: morning.id }] });
    const holiday = await addTimeline(laptop, `Holiday ${tag}`, { placements: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '18:00', to: '20:00', dashboardId: evening.id }] });
    let screenId: string | null = null;
    try {
      // The wall names itself.
      const wall = await wallContext.newPage();
      await verifySettingsPinViaAPI(wall, parent.name);
      const named = await wall.request.post('/api/displays', { data: { name: NAME } });
      expect(named.ok()).toBe(true);
      screenId = (await named.json()).display?.id ?? (await (await wall.request.get('/api/displays')).json()).currentId;

      // From the laptop: the screen's row, its dropdown.
      await verifySettingsPinViaAPI(laptop, parent.name);
      await laptop.goto('/settings?section=displays');
      const row = laptop.getByTestId('display-row').filter({ hasText: NAME });
      await row.getByLabel(`Timeline for ${NAME}`).selectOption({ label: `School ${tag}` });
      await expect(row.locator('[data-screen-summary]')).toContainText(`School ${tag}: `);
      await expect.poll(async () => (await (await laptop.request.get('/api/displays')).json()).displays.find((d: { id: string }) => d.id === screenId)?.timelineId)
        .toBe(school.id);

      // Its editor: School's switch, Morning from 7 to 8.
      await row.getByRole('link', { name: 'Edit' }).click();
      await expect(laptop).toHaveURL(/\/screens\//, { timeout: 60_000 });
      await laptop.locator('[data-editor-open="day"]').click({ timeout: 90_000 });
      const sheet = laptop.locator('[data-editor-sheet="day"]');
      await expect(sheet.getByText('This screen follows')).toBeVisible();
      await expect(sheet.getByLabel('Timeline', { exact: true })).toHaveValue(school.id);
      await expect(rows(laptop)).toHaveCount(1);
      await expect(rows(laptop).first().getByLabel('Switches to')).toHaveValue(morning.id);
      await expect(rows(laptop).first().getByLabel('Switch starts')).toHaveValue('07:00');

      // The editor's dropdown: Holiday instead. Its rows, and the screen follows it.
      await sheet.getByLabel('Timeline', { exact: true }).selectOption(holiday.id);
      await expect(rows(laptop).first().getByLabel('Switches to')).toHaveValue(evening.id);
      await expect(rows(laptop).first().getByLabel('Switch starts')).toHaveValue('18:00');
      await expect(rows(laptop)).toHaveCount(1);
      await expect.poll(async () => (await (await laptop.request.get('/api/displays')).json()).displays.find((d: { id: string }) => d.id === screenId)?.timelineId)
        .toBe(holiday.id);
      await expect(sheet.locator('[data-timeline-used]')).toHaveText('Used by 1 screen.');
    } finally {
      if (screenId) await laptop.request.delete(`/api/displays/${screenId}`);
      await laptop.request.delete(`/api/timelines/${school.id}`);
      await laptop.request.delete(`/api/timelines/${holiday.id}`);
      await laptop.request.delete(`/api/layouts/${morning.id}`);
      await laptop.request.delete(`/api/layouts/${evening.id}`);
      await wallContext.close();
      await laptopContext.close();
    }
  });

  test('a duplicate goes its own way, and a deleted timeline\'s screens follow the first', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page);
    const bus = await addDashboard(page, `Bus ${tag}`);
    const source = await addTimeline(page, `Source ${tag}`, {
      placements: [{ days: [1, 2, 3, 4, 5], from: '07:00', to: '07:45', dashboardId: bus.id }],
      idleBackground: { day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } },
    });
    const made: string[] = [source.id];
    let screenId: string | null = null;
    try {
      const dup = await page.request.post('/api/timelines', { data: { copyOf: source.id } });
      expect(dup.status()).toBe(201);
      const copy = (await dup.json()).timeline as Timeline;
      made.push(copy.id);
      const now = await list(page);
      const [a, b] = [now.find((t) => t.id === source.id)!, now.find((t) => t.id === copy.id)!];
      expect(b.name).toBe(`Source ${tag} copy`);
      expect([b.dashboardId, b.placements, b.idleBackground]).toEqual([a.dashboardId, a.placements, a.idleBackground]);
      // Last in the list.
      expect(Math.max(...now.map((t) => t.position))).toBe(b.position);

      // An edit to either leaves the other alone.
      await page.request.patch(`/api/timelines/${copy.id}`, { data: { placements: [], idleBackground: { source: 'off' } } });
      await page.request.patch(`/api/timelines/${source.id}`, { data: { name: `Source ${tag} renamed` } });
      const after = await list(page);
      expect(after.find((t) => t.id === source.id)!.placements).toEqual(a.placements);
      expect(after.find((t) => t.id === source.id)!.idleBackground).toEqual(a.idleBackground);
      expect(after.find((t) => t.id === copy.id)!.name).toBe(`Source ${tag} copy`);

      // A screen on the copy; the copy goes; the screen follows the first.
      const wall = await context.newPage();
      const named = await wall.request.post('/api/displays', { data: { name: `Porch ${tag}` } });
      expect(named.ok()).toBe(true);
      screenId = (await (await wall.request.get('/api/displays')).json()).currentId;
      expect((await page.request.patch(`/api/displays/${screenId}`, { data: { timelineId: copy.id } })).ok()).toBe(true);
      expect((await list(page)).find((t) => t.id === copy.id)!.screens).toBe(1);
      expect((await page.request.delete(`/api/timelines/${copy.id}`)).ok()).toBe(true);
      made.pop();
      const screen = (await (await page.request.get('/api/displays')).json()).displays.find((d: { id: string }) => d.id === screenId);
      expect(screen.timelineId, 'on the household\'s first').toBeNull();
      const first = (await list(page))[0]!;
      expect(first.screens).toBeGreaterThanOrEqual(1);
    } finally {
      if (screenId) await page.request.delete(`/api/displays/${screenId}`);
      for (const id of made) await page.request.delete(`/api/timelines/${id}`);
      await page.request.delete(`/api/layouts/${bus.id}`);
      await context.close();
    }
  });
});
