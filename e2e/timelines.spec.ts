import { test, expect, type Page } from '@playwright/test';
import { getFirstParent, getSeededParentId, verifySettingsPinViaAPI } from './helpers/auth';

/**
 * Timelines (#1266): a screen picks a timeline from a dropdown, and the
 * timeline says which dashboard shows when. Days come first in Through the
 * day: a dashboard placed on Weekdays is one block, on Monday to Friday. The
 * last test reads the database through the API: a duplicate goes its own way,
 * and the screens on a deleted timeline follow the household's first.
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

const blocks = (page: Page) => page.locator('[data-editor-sheet="day"] [data-day-placement]');
const dayChip = (page: Page, name: string) => page.locator('[data-editor-sheet="day"]').getByRole('group', { name: 'Each day' }).getByRole('button', { name, exact: true });

test.describe('timelines (#1266)', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(240_000);

  test('Weekdays, then + Dashboard: one block that shows on Monday to Friday and not on Saturday', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const tag = Date.now().toString(36);
    const board = await addDashboard(page, `Line board ${tag}`);
    const bus = await addDashboard(page, `Bus ${tag}`);
    const own = await addTimeline(page, `School days ${tag}`, { dashboardId: board.id });
    try {
      // A laptop edits on the canvas (#1265); Through the day edits whichever
      // timeline is picked at its top.
      await page.goto(`/edit/${board.id}`);
      await page.locator('[data-editor-open="day"]').click({ timeout: 90_000 });
      const sheet = page.locator('[data-editor-sheet="day"]');
      await sheet.getByLabel('Timeline', { exact: true }).selectOption(own.id);
      await expect(sheet.locator('[data-day-lane="in-use"]')).toHaveText(`Line board ${tag}`);

      await sheet.locator('[data-day-preset="Weekdays"]').click();
      await expect(sheet.locator('[data-day-preset="Weekdays"]')).toHaveAttribute('aria-pressed', 'true');
      // A new placement starts at the time played; 7:00, so it does not run
      // past midnight whenever the test runs.
      await sheet.locator('[data-day-slider]').fill('420');
      await sheet.locator('[data-placement-add]').click();
      await sheet.locator('[data-day-card="placement"]').getByLabel('Placed dashboard').selectOption({ label: `Bus ${tag}` });

      // Kept on the timeline as one placement on the five days.
      await expect.poll(async () => (await list(page)).find((t) => t.id === own.id)!.placements.map((p) => [p.days, p.dashboardId]))
        .toEqual([[[1, 2, 3, 4, 5], bus.id]]);
      await expect(blocks(page)).toHaveCount(1);
      await expect(blocks(page).first()).toHaveText(`Bus ${tag}`);
      // On a whole-width line: one block, not one per day.
      const lane = await sheet.locator('[data-day-lane="in-use"]').evaluate((el) => el.getBoundingClientRect().toJSON());
      const block = await blocks(page).first().evaluate((el) => el.getBoundingClientRect().toJSON());
      expect(block.left).toBeGreaterThanOrEqual(lane.left - 0.5);
      expect(block.right).toBeLessThanOrEqual(lane.right + 0.5);

      // Saturday alone: not on it.
      await sheet.locator('[data-day-preset="Weekend"]').click();
      await dayChip(page, 'Sunday').click();
      await expect(sheet.locator('[data-day-set]')).toHaveAttribute('data-day-set', '6');
      await expect(blocks(page)).toHaveCount(0);
      // Each weekday alone: on it.
      for (const [day, others] of [['Monday', ['Tuesday', 'Wednesday', 'Thursday', 'Friday']], ['Friday', ['Monday', 'Tuesday', 'Wednesday', 'Thursday']]] as const) {
        await sheet.locator('[data-day-preset="Weekdays"]').click();
        for (const d of others) await dayChip(page, d).click();
        await expect(dayChip(page, day)).toHaveAttribute('aria-pressed', 'true');
        await expect(blocks(page), `on ${day}`).toHaveCount(1);
      }

      // Every day: the block is on some of the days shown, so it says which,
      // as days, in dark words that can be read on its light fill.
      await sheet.locator('[data-day-preset="Every day"]').click();
      await expect(blocks(page).first()).toHaveAttribute('data-partial', 'true');
      await expect(blocks(page).first().locator('[data-placement-days]')).toHaveText('Mon–Fri');
      const contrast = await blocks(page).first().evaluate((block) => {
        // Colours read through a 1px canvas, which takes any CSS colour, with
        // each background under the block painted from the page up.
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        ctx.canvas.width = 1; ctx.canvas.height = 1;
        const under: string[] = [];
        for (let e: Element | null = block; e; e = e.parentElement) under.unshift(getComputedStyle(e).backgroundColor);
        const paint = (top?: string) => {
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1, 1);
          for (const c of under) { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); }
          if (top) { ctx.fillStyle = top; ctx.fillRect(0, 0, 1, 1); }
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
        };
        const ratio = (el: Element) => {
          const bg = paint();
          const text = paint(getComputedStyle(el).color);
          return (Math.max(bg, text) + 0.05) / (Math.min(bg, text) + 0.05);
        };
        return { name: ratio(block.querySelector('[data-placement-name]')!), days: ratio(block.querySelector('[data-placement-days]')!) };
      });
      expect(contrast.name, 'the name on a some-days block').toBeGreaterThanOrEqual(4.5);
      expect(contrast.days, 'the days on a some-days block').toBeGreaterThanOrEqual(4.5);
    } finally {
      await page.request.delete(`/api/timelines/${own.id}`);
      await page.request.delete(`/api/layouts/${bus.id}`);
      await page.request.delete(`/api/layouts/${board.id}`);
    }
  });

  test('with a mouse the panel\'s controls are sized for a desk, and a finger still gets 44px', async ({ browser }) => {
    const tag = Date.now().toString(36);
    /** Heights (and widths) of the Through the day controls on the canvas editor. */
    const measure = async (touch: boolean) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: touch });
      const page = await context.newPage();
      await signIn(page);
      const board = await addDashboard(page, `Sizes ${touch ? 'touch' : 'mouse'} ${tag}`);
      try {
        await page.goto(`/edit/${board.id}`);
        await page.locator('[data-editor-open="day"]').click({ timeout: 90_000 });
        const sheet = page.locator('[data-editor-sheet="day"]');
        await expect(sheet.locator('[data-day-lane="nobody"]')).toBeVisible();
        const box = async (selector: string) => (await sheet.locator(selector).first().boundingBox())!;
        // The words on each kind of control: presets, days, + Dashboard, More.
        const fonts = await sheet.evaluate((el) => ['[data-day-preset="Weekdays"]', '[data-day-chip="1"]', '[data-placement-add]', '[data-day-more]']
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
          preset: await box('[data-day-preset="Weekdays"]'),
          day: await box('[data-day-chip="1"]'),
          add: await box('[data-placement-add]'),
          select: await box('[data-timeline-select]'),
          menu: await box('[data-timeline-menu]'),
          inUse: await box('[data-day-lane="in-use"]'),
          nobody: await box('[data-day-lane="nobody"]'),
          dot: await box('[data-day-milestone]'),
          tab: (await page.locator('[data-editor-open="day"]').boundingBox())!,
          done: (await page.locator('[data-editor-done]').boundingBox())!,
        } };
      } finally {
        await page.request.delete(`/api/layouts/${board.id}`);
        await context.close();
      }
    };

    // A mouse: controls 28 to 36px, so the panel does not outweigh the canvas,
    // + Dashboard shares the presets' row, and every control's words are one
    // size (the day presets were larger than the rest).
    const { box: mouse, fonts, days, tabWords, tabGround } = await measure(false);
    expect(new Set(fonts.map((f) => f.split(' ').pop())).size, fonts.join('; ')).toBe(1);
    for (const [name, b] of Object.entries(mouse)) {
      if (name === 'tab') continue;
      expect(b.height, `${name} with a mouse`).toBeGreaterThanOrEqual(28);
      expect(b.height, `${name} with a mouse`).toBeLessThanOrEqual(36);
    }
    expect(Math.abs(mouse.add.y + mouse.add.height / 2 - (mouse.preset.y + mouse.preset.height / 2))).toBeLessThanOrEqual(1);
    // The timeline's own actions are one button on its dropdown's row.
    expect(Math.abs(mouse.menu.y + mouse.menu.height / 2 - (mouse.select.y + mouse.select.height / 2)), 'menu beside the dropdown').toBeLessThanOrEqual(1);
    expect(mouse.menu.x).toBeGreaterThan(mouse.select.x + mouse.select.width);
    // The seven days on one row, all one width, wide enough for Mon and Wed.
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
    expect(finger.dot.width).toBeGreaterThanOrEqual(44);
  });

  test('switching a screen\'s timeline from the dropdown changes what its line shows', async ({ browser }) => {
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

      // Its editor: the line is School's, Morning from 7 to 8.
      // Edit on the row opens the canvas editor for that screen (#1267).
      await row.getByRole('link', { name: 'Edit' }).click();
      await expect(laptop).toHaveURL(new RegExp(`/screens/${screenId}$`), { timeout: 60_000 });
      await expect(laptop.getByRole('heading', { level: 1 })).toContainText(NAME);
      await laptop.locator('[data-editor-open="day"]').click({ timeout: 90_000 });
      const sheet = laptop.locator('[data-editor-sheet="day"]');
      await expect(sheet.getByText('This screen follows')).toBeVisible();
      await expect(sheet.getByLabel('Timeline', { exact: true })).toHaveValue(school.id);
      await expect(blocks(laptop)).toHaveCount(1);
      await expect(blocks(laptop).first()).toHaveText(`Morning ${tag}`);
      await expect(blocks(laptop).first()).toHaveAttribute('data-from', String(7 * 60));

      // The editor's dropdown: Holiday instead. Its line, and the screen follows it.
      await sheet.getByLabel('Timeline', { exact: true }).selectOption(holiday.id);
      await expect(blocks(laptop).first()).toHaveText(`Evening ${tag}`);
      await expect(blocks(laptop).first()).toHaveAttribute('data-from', String(18 * 60));
      await expect(blocks(laptop)).toHaveCount(1);
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
