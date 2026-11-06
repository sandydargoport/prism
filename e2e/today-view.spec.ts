import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';
import { TODAY_TEMPLATE } from '../src/lib/constants/layoutTemplates';

/** The Today parts with the arc switched on (#1030: it is an option, off by default). */
const ARC_WIDGETS = TODAY_TEMPLATE.widgets.map((w) => (w.i === 'calendar' ? { ...w, settings: { ...(w.settings ?? {}), arc: true } } : w));

/**
 * Today (#907): a dashboard drawn as one scene over the photo instead of the
 * widget grid. Needs the seeded test database to log in and create layouts.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const PIN = process.env.E2E_PIN || '1234';

/**
 * Create an event, waiting out the per-user limit (30 a minute) the way
 * calendar-geometry does: a busy day makes a dozen at once.
 */
async function postEvent(page: Page, data: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const res = await page.request.post('/api/events', { data });
    if (res.status() !== 429 || attempt >= 3) return res;
    const wait = Number(res.headers()['retry-after'] ?? '20');
    await page.waitForTimeout(Math.min(Math.max(wait, 1), 65) * 1000);
  }
}

test.describe('the Today view', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database to log in and create a dashboard');
  test.setTimeout(90_000);

  const day = new Date();
  const WEATHER = {
    location: 'Springfield',
    current: { temperature: 76, feelsLike: 75, condition: 'partly-cloudy', humidity: 48, windSpeed: 8, description: 'Partly Cloudy' },
    forecast: [{ date: day.toISOString(), dayName: 'Today', high: 79, low: 61, condition: 'partly-cloudy' }],
    hourly: [],
    units: { temperature: 'F', windSpeed: 'mph', precipitation: 'in' },
    lastUpdated: day.toISOString(),
  };

  async function login(page: Page) {
    const res = await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: PIN } });
    expect(res.ok(), 'precondition: login must succeed').toBe(true);
  }

  test('the layouts API keeps the view: Today when asked, the grid otherwise', async ({ page }) => {
    await login(page);
    const made: string[] = [];
    try {
      const today = await page.request.post('/api/layouts', { data: { name: `Today api ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } });
      expect(today.status()).toBe(201);
      const t = await today.json(); made.push(t.id);
      expect(t.view).toBe('today');

      const grid = await page.request.post('/api/layouts', { data: { name: `Grid api ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets } });
      const g = await grid.json(); made.push(g.id);
      expect(g.view, 'a new dashboard is a grid by default').toBe('grid');

      // A rename leaves the view alone; an unknown view is refused.
      const renamed = await page.request.patch(`/api/layouts/${t.id}`, { data: { name: 'Renamed Today' } });
      expect((await renamed.json()).view).toBe('today');
      const bad = await page.request.patch(`/api/layouts/${t.id}`, { data: { view: 'freeform' } });
      expect(bad.status()).toBe(400);
    } finally {
      for (const id of made) await page.request.delete(`/api/layouts/${id}`);
    }
  });

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    test(`a Today layout draws the corners on the photo, not a grid, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page);
      const created = await page.request.post('/api/layouts', { data: { name: `Today e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } });
      const layout = await created.json();
      try {
        await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
        await page.goto(`/d/${layout.slug}`);
        await page.locator('[data-today-scene]').waitFor({ timeout: 60_000 });
        await page.locator('[data-today-weather]').waitFor();

        await expect(page.locator('.widget-cell'), 'no grid cells').toHaveCount(0);
        const m = await page.evaluate(() => {
          const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
          const size = (sel: string) => parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize);
          const probe = document.createElement('div');
          probe.style.fontSize = 'var(--text-floor)';
          document.body.appendChild(probe);
          const floor = parseFloat(getComputedStyle(probe).fontSize);
          probe.remove();
          return {
            scene: box('[data-today-scene]'),
            clock: box('[data-today-clock]'),
            weather: box('[data-today-corner="right"]'),
            sizes: ['[data-today-date]', '[data-today-clock]', '[data-today-temp]', '[data-today-weather]'].map(size),
            floor,
            scroll: document.documentElement.scrollWidth > window.innerWidth,
            clockFont: getComputedStyle(document.querySelector('[data-today-clock]')!).fontFamily,
          };
        });
        expect(m.clock.left - m.scene.left, 'clock near the left edge of the scene').toBeLessThan(70);
        expect(m.scene.right - m.weather.right, 'weather near the right edge').toBeLessThan(70);
        expect(Math.abs(m.clock.top - m.weather.top), 'one top line').toBeLessThan(40);
        for (const s of m.sizes) expect(s).toBeGreaterThanOrEqual(m.floor - 0.01);
        expect(m.scroll, 'no sideways scroll').toBe(false);
        expect(m.clockFont, 'the clock in the display face').toMatch(/Literata/i);
        await expect(page.locator('[data-today-weather]')).toHaveText('Partly Cloudy, high 79°F');
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
      }
    });
  }

  // #909: the day as the sun's path, each timed event a bead on it, in time order.
  test('the sun arc puts each event as a bead on the path, in time order', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const parentId = getSeededParentId();
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
    const made: string[] = [];
    for (const [title, h] of [['Arc check late', 21], ['Arc check early', 19], ['Arc check mid', 20]] as const) {
      const res = await postEvent(page, { title, startTime: at(h), endTime: at(h, 30), allDay: false, createdBy: parentId });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const created = await page.request.post('/api/layouts', { data: { name: `Arc e2e ${Date.now()}`, widgets: ARC_WIDGETS, view: 'today' } });
    const layout = await created.json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: { ...WEATHER, sunrise: at(6, 30), sunset: at(17, 30) } }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-arc-bead]').first().waitFor({ timeout: 60_000 });
      await expect(page.locator('[data-arc-sunset]')).toHaveCount(1);
      const m = await page.evaluate(() => {
        const path = document.querySelector('[data-arc-path]') as SVGPathElement;
        const len = path.getTotalLength();
        const samples: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= 2000; i++) { const p = path.getPointAtLength((len * i) / 2000); samples.push({ x: p.x, y: p.y }); }
        return [...document.querySelectorAll('[data-arc-bead]')].map((b) => {
          const cx = Number(b.getAttribute('cx')), cy = Number(b.getAttribute('cy'));
          const off = Math.min(...samples.map((p) => Math.hypot(p.x - cx, p.y - cy)));
          return { start: Number(b.getAttribute('data-start')), cx, off };
        });
      });
      expect(m.length).toBeGreaterThanOrEqual(3);
      for (const b of m) expect(b.off, 'bead on the path').toBeLessThanOrEqual(2);
      const byStart = [...m].sort((a, b) => a.start - b.start);
      for (let i = 1; i < byStart.length; i++) {
        if (byStart[i]!.start > byStart[i - 1]!.start) expect(byStart[i]!.cx, 'later is further right').toBeGreaterThan(byStart[i - 1]!.cx);
      }
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });

  // #910: a busy day stays readable: no two labels overlap, none leaves the
  // screen. #993: what does not fit stays a bead, with no "+N" count.
  test('a 12-event day keeps its labels apart, and what does not fit is a bead, not a count', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    // 9 in the morning, so every event is still ahead whenever the suite runs.
    // Only the date is fixed: timers and animation frames keep running.
    await page.clock.setFixedTime(at(9));
    await login(page);
    const parentId = getSeededParentId();
    const made: string[] = [];
    for (let i = 0; i < 12; i++) {
      const start = at(10 + Math.floor(i / 2), (i % 2) * 30);
      const res = await postEvent(page, {
        title: `Busy ${i + 1} practice`, startTime: start.toISOString(), endTime: new Date(start.getTime() + 25 * 60_000).toISOString(), allDay: false, createdBy: parentId,
      });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const created = await page.request.post('/api/layouts', { data: { name: `Busy e2e ${Date.now()}`, widgets: ARC_WIDGETS, view: 'today' } });
    const layout = await created.json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: { ...WEATHER, sunrise: at(6, 30).toISOString(), sunset: at(17, 30).toISOString() } }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-arc-label]').first().waitFor({ timeout: 60_000 });
      const m = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('[data-arc-label], [data-arc-sunset-label]')]
          .map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: el.textContent }; });
        const overlaps: string[] = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!, b = rects[j]!;
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${a.text} / ${b.text}`);
        }
        const outside = rects.filter((r) => r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight).map((r) => r.text);
        return {
          overlaps, outside,
          labels: document.querySelectorAll('[data-arc-label]').length,
          ahead: document.querySelectorAll('[data-arc-bead]:not([data-past])').length,
          hits: document.querySelectorAll('[data-arc-bead-hit]').length,
          counts: [...document.querySelectorAll('[data-sun-arc] *')].filter((el) => el.children.length === 0 && /^\s*\+\s*\d+/.test(el.textContent ?? '')).length,
        };
      });
      expect(m.overlaps, 'no two labels overlap').toEqual([]);
      expect(m.outside, 'every label on screen').toEqual([]);
      // The 12 here, plus any the seeded family already has today.
      expect(m.ahead).toBeGreaterThanOrEqual(12);
      expect(m.labels, 'not every event gets a label on a day this busy').toBeLessThan(m.ahead);
      expect(m.labels).toBeGreaterThan(0);
      expect(m.counts, 'no "+N" count anywhere on the arc').toBe(0);
      expect(m.hits, 'every event is a bead that can be tapped').toBeGreaterThanOrEqual(m.ahead);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });

  // #836: one event sheet, opened from a bead on Today and from the
  // dashboard's calendar widget; "+" on the widget adds on the shown day.
  test('tapping an event on Today or on the calendar widget opens its sheet', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    // Only the date is fixed: timers and animation frames keep running.
    await page.clock.setFixedTime(at(9));
    await login(page);
    const title = `Sheet tap ${Date.now()}`;
    const ev = await postEvent(page, {
      title, startTime: at(14).toISOString(), endTime: at(15, 30).toISOString(), allDay: false, location: 'Community Park', createdBy: getSeededParentId(),
    });
    expect(ev.status()).toBe(201);
    const event = await ev.json();
    const made: string[] = [];
    try {
      const today = await (await page.request.post('/api/layouts', { data: { name: `Tap today ${Date.now()}`, widgets: ARC_WIDGETS, view: 'today' } })).json();
      made.push(today.id);
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${today.slug}`);
      const hit = page.locator(`[data-arc-bead-hit][data-title="${title}"]`);
      await hit.waitFor({ timeout: 60_000 });
      const box = await hit.boundingBox();
      expect(box!.width, 'a 44px target round the bead').toBeGreaterThanOrEqual(44);
      await hit.click();
      const sheet = page.locator('[data-event-sheet]');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('heading', { name: title })).toBeVisible();
      await expect(sheet.locator('[data-event-sentence]')).toContainText('2 to 3:30, at Community Park');
      const close = await sheet.locator('[data-sheet-close]').boundingBox();
      expect(close!.width).toBeGreaterThanOrEqual(44);
      expect(close!.height).toBeGreaterThanOrEqual(44);
      await sheet.locator('[data-sheet-close]').click();
      await expect(sheet).toBeHidden();

      const grid = await (await page.request.post('/api/layouts', { data: { name: `Tap grid ${Date.now()}`, widgets: [{ i: 'calendar', x: 0, y: 0, w: 48, h: 27 }] } })).json();
      made.push(grid.id);
      await page.goto(`/d/${grid.slug}`);
      const chip = page.locator('.widget-cell[data-widget="calendar"]').getByText(title).first();
      await chip.waitFor({ timeout: 30_000 });
      await chip.click({ timeout: 15_000 });
      await expect(page.locator('[data-event-sheet]').getByRole('heading', { name: title })).toBeVisible();
      await page.locator('[data-event-sheet] [data-sheet-close]').click();
      await expect(page.locator('[data-event-sheet]')).toBeHidden();

      await page.locator('[data-calendar-add]').click({ timeout: 15_000 });
      await expect(page.getByRole('dialog').getByText(/New Event/i)).toBeVisible();
    } finally {
      for (const id of made) await page.request.delete(`/api/layouts/${id}`);
      await page.request.delete(`/api/events/${event.id}`);
    }
  });

  // #805: the coming days as sentences, bottom left, at the text floor or above.
  test('the coming days read as sentences in the lower left', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const d = new Date();
    const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9);
    const title = `Dentist ${Date.now()}`;
    const ev = await postEvent(page, { title, startTime: tomorrow.toISOString(), endTime: new Date(tomorrow.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() });
    expect(ev.status()).toBe(201);
    const event = await ev.json();
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Days e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      const block = page.locator('[data-today-coming]');
      await block.waitFor({ timeout: 60_000 });
      await expect(block.locator('dt').first()).toHaveText('Tomorrow');
      await expect(block.locator('dd').first()).toContainText(`${title} at 9`);
      const m = await page.evaluate(() => {
        const scene = document.querySelector('[data-today-scene]')!.getBoundingClientRect();
        const b = document.querySelector('[data-today-coming]')!.getBoundingClientRect();
        const probe = document.createElement('div');
        probe.style.fontSize = 'var(--text-floor)';
        document.body.appendChild(probe);
        const floor = parseFloat(getComputedStyle(probe).fontSize);
        probe.remove();
        const sizes = [...document.querySelectorAll('[data-today-coming] dt, [data-today-coming] dd, [data-today-more]')]
          .map((el) => parseFloat(getComputedStyle(el).fontSize));
        return { scene, b, floor, sizes };
      });
      expect(m.b.left - m.scene.left, 'left side').toBeLessThan(m.scene.width / 2);
      expect(m.b.right - m.scene.left, 'stays in the left part').toBeLessThanOrEqual(m.scene.width * 0.6);
      expect(m.b.top - m.scene.top, 'lower half').toBeGreaterThan(m.scene.height / 2);
      expect(m.b.bottom).toBeLessThanOrEqual(m.scene.bottom);
      for (const s of m.sizes) expect(s).toBeGreaterThanOrEqual(m.floor - 0.01);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      await page.request.delete(`/api/events/${event.id}`);
    }
  });

  // #911: quiet lines and the birthday nudge.
  test('the quiet lines have 44px controls, and the birthday nudge adds a task or goes away', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const d = new Date();
    await page.clock.setFixedTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10));
    await login(page);
    const soon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
    const name = `Aunt Bea ${Date.now() % 100000}`;
    const birthDate = `1950-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const created = await page.request.post('/api/birthdays', { data: { name, birthDate } });
    expect(created.ok()).toBe(true);
    const birthday = await created.json();
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Quiet e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    let taskId: string | undefined;
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      const nudge = page.locator('[data-today-nudge]');
      await expect(nudge).toContainText(name, { timeout: 60_000 });
      await expect(nudge).toContainText('Mail a card by');

      // Every control on the quiet lines is a 44px target.
      const small = await page.evaluate(() => [...document.querySelectorAll('[data-today-quiet] button')]
        .map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length);
      expect(small, 'controls under 44px').toBe(0);

      // Add it: a task to mail a card, and this birthday's line goes.
      await nudge.getByRole('button', { name: 'Add it' }).click();
      await expect.poll(async () => {
        const res = await (await page.request.get('/api/tasks')).json();
        const task = ((res.tasks ?? res) as Array<{ id: string; title: string }>).find((t) => t.title === `Mail a card to ${name}`);
        taskId = task?.id;
        return !!task;
      }, { timeout: 15_000 }).toBe(true);
      await expect(page.locator('[data-today-nudge]').filter({ hasText: name })).toHaveCount(0);

      // Not now: whatever is offered next goes away, and stays away after a reload.
      for (let i = 0; i < 5 && (await page.locator('[data-today-nudge]').count()) > 0; i++) {
        await page.locator('[data-today-nudge]').getByRole('button', { name: 'Not now' }).click();
      }
      await expect(page.locator('[data-today-nudge]')).toHaveCount(0);
      await page.reload();
      await page.locator('[data-today-scene]').waitFor();
      await page.waitForTimeout(1500);
      await expect(page.locator('[data-today-nudge]')).toHaveCount(0);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      await page.request.delete(`/api/birthdays/${birthday.id}`);
      if (taskId) await page.request.delete(`/api/tasks/${taskId}`);
    }
  });

  // #926: calm idle and night.
  test('going idle fades the sentences, keeps the clock still, and the first tap only wakes', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const d = new Date();
    await page.clock.setFixedTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9));
    await login(page);
    const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9);
    const later = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 15);
    const made: string[] = [];
    for (const [title, start] of [[`Idle tomorrow ${Date.now()}`, tomorrow], [`Idle later ${Date.now()}`, later]] as const) {
      const r = await postEvent(page, { title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() });
      made.push((await r.json()).id);
    }
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Idle e2e ${Date.now()}`, widgets: ARC_WIDGETS, view: 'today' } })).json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-today-coming]').waitFor({ timeout: 60_000 });
      const clockBefore = await page.locator('[data-today-clock]').boundingBox();
      await page.evaluate(() => window.dispatchEvent(new Event('prism:screensaver')));
      await expect(page.locator('[data-today-scene]')).toHaveAttribute('data-today-idle', 'true');
      await expect.poll(() => page.locator('[data-today-coming-wrap]').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
      const clockAfter = await page.locator('[data-today-clock]').boundingBox();
      expect(Math.abs(clockAfter!.x - clockBefore!.x) + Math.abs(clockAfter!.y - clockBefore!.y), 'the clock stays put').toBeLessThanOrEqual(6);
      // Only the next event keeps its label.
      await expect(page.locator('[data-arc-label]')).toHaveCount(1);
      // A tap on a bead while idle opens nothing.
      const hit = page.locator('[data-arc-bead-hit]').first();
      const box = await hit.boundingBox();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.waitForTimeout(800);
      await expect(page.locator('[data-event-sheet]')).toHaveCount(0);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });

  test('after dusk the ink turns warm, a veil comes up, and the moon sits on its curve', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    await page.clock.setFixedTime(at(19, 0));
    await login(page);
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Night e2e ${Date.now()}`, widgets: ARC_WIDGETS, view: 'today' } })).json();
    try {
      const tomorrow = (h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, h);
      await page.route('**/api/weather*', (route) => route.fulfill({ json: { ...WEATHER, sunrise: at(6, 30).toISOString(), sunset: at(16, 40).toISOString(), moonrise: at(17, 30).toISOString(), moonset: tomorrow(9).toISOString(), moonPhase: 0.3 } }));
      await page.goto(`/d/${layout.slug}`);
      await expect(page.locator('[data-today-scene]')).toHaveAttribute('data-today-night', 'true', { timeout: 60_000 });
      const ink = await page.locator('[data-today-clock]').evaluate((el) => getComputedStyle(el).color);
      expect(ink).toBe('rgb(255, 226, 190)');
      await expect(page.locator('[data-today-veil]')).toHaveCount(1);
      await expect(page.locator('[data-sun-down]'), 'the sun is down').toHaveCount(1);
      // #994: the moon is on its own curve, not pinned in a corner.
      await expect(page.locator('[data-today-moon]'), 'no moon pinned to a corner').toHaveCount(0);
      await expect(page.locator('[data-arc-moon]')).toHaveCount(1);
      const m = await page.evaluate(() => {
        const moon = document.querySelector('[data-arc-moon]')!.getBoundingClientRect();
        const cx = moon.left + moon.width / 2, cy = moon.top + moon.height / 2;
        const sample = (sel: string) => {
          const path = document.querySelector(sel) as SVGPathElement;
          const m = path.getScreenCTM()!;
          const pts: Array<{ x: number; y: number }> = [];
          const len = path.getTotalLength();
          for (let i = 0; i <= 200; i++) {
            const p = path.getPointAtLength((len * i) / 200);
            pts.push({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
          }
          return pts;
        };
        const moonPath = sample('[data-arc-moon-path]');
        const night = sample('[data-arc-piece="night"]').map((p) => p.y);
        return {
          gap: Math.min(...moonPath.map((p) => Math.hypot(p.x - cx, p.y - cy))),
          nightRange: Math.max(...night) - Math.min(...night),
        };
      });
      expect(m.gap, 'the moon sits on its curve').toBeLessThanOrEqual(4);
      expect(m.nightRange, 'the evening line curves, it is not flat').toBeGreaterThan(6);
      // Nothing to do this evening: the line says so without covering the moon.
      const empty = page.locator('[data-arc-empty]');
      if (await empty.count()) {
        const a = (await empty.boundingBox())!, b = (await page.locator('[data-arc-moon]').boundingBox())!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, '"Nothing else today" clear of the moon').toBe(false);
      }
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
    }
  });

  // #934: Today in portrait.
  test('in portrait the corners, arc labels, sentences and quiet lines do not overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 });
    await login(page);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    const ev = await postEvent(page, { title: `Portrait dentist ${Date.now()}`, startTime: tomorrow.toISOString(), endTime: new Date(tomorrow.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() });
    const event = await ev.json();
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Portrait e2e ${Date.now()}`, widgets: ARC_WIDGETS, view: 'today' } })).json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-today-coming]').waitFor({ timeout: 60_000 });
      const m = await page.evaluate(() => {
        const box = (el: Element) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, name: el.getAttribute('data-name') }; };
        const parts = [
          ...[...document.querySelectorAll('[data-today-corner], [data-today-coming], [data-today-quiet], [data-arc-label], [data-arc-sunset-label]')].map((el) => ({ ...box(el), name: [...el.attributes].map((a) => a.name).find((n) => n.startsWith('data-')) })),
        ];
        const overlaps: string[] = [];
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i]!, b = parts[j]!;
          if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps.push(`${a.name} / ${b.name}`);
        }
        const probe = document.createElement('div'); probe.style.fontSize = 'var(--text-floor)'; document.body.appendChild(probe);
        const floor = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
        const small = [...document.querySelectorAll('[data-today-scene] *')]
          .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() && parseFloat(getComputedStyle(el).fontSize) < floor - 0.01).length;
        const scene = document.querySelector('[data-today-scene]')!.getBoundingClientRect();
        const coming = document.querySelector('[data-today-coming-wrap]')!.getBoundingClientRect();
        const arc = document.querySelector('[data-today-arc]')!.getBoundingClientRect();
        return {
          overlaps, small, sideways: document.documentElement.scrollWidth > innerWidth,
          comingWidth: coming.width / scene.width, comingTop: (coming.top - scene.top) / scene.height,
          belowArc: coming.top >= arc.bottom - 1,
        };
      });
      expect(m.overlaps).toEqual([]);
      // Portrait's own composition: the sentences take the width, just below the arc.
      expect(m.comingWidth, 'sentences across the width').toBeGreaterThan(0.8);
      expect(m.comingTop, 'in the upper half').toBeLessThan(0.55);
      expect(m.belowArc, 'below the arc').toBe(true);
      expect(m.small, 'text under the floor').toBe(0);
      expect(m.sideways).toBe(false);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      await page.request.delete(`/api/events/${event.id}`);
    }
  });

  // #927: the editor shows Today's parts, not a grid; hiding one and choosing
  // one day ahead changes the scene once saved.
  // #1030: Simple leads with today as a list; the arc is an option.
  test('Today leads with Next and later today, and the arc only when switched on', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const d = new Date();
    const at = (h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    await page.clock.setFixedTime(at(9));
    const tag = Date.now();
    const made: string[] = [];
    for (const [title, s, e] of [[`List first ${tag}`, at(10), at(11)], [`List second ${tag}`, at(14), at(15)]] as const) {
      const res = await postEvent(page, { title, startTime: s.toISOString(), endTime: e.toISOString(), allDay: false, createdBy: getSeededParentId() });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const layout = await (await page.request.post('/api/layouts', { data: { name: `List e2e ${tag}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      const list = page.locator('[data-today-list="wall"]');
      await expect(list).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-today-arc]'), 'no arc by default').toHaveCount(0);
      await expect(list.locator('[data-today-next]')).toContainText(`List first ${tag}`);
      await expect(list.getByText('Next', { exact: true })).toBeVisible();
      await expect(list.locator('[data-today-later-row]').filter({ hasText: `List second ${tag}` })).toBeVisible();
      // Next comes before later today.
      const order = await page.evaluate((t) => {
        const y = (s: string) => document.querySelector(s)!.getBoundingClientRect().top;
        const later = [...document.querySelectorAll('[data-today-later-row]')].find((e) => e.textContent?.includes(t))!;
        return { next: y('[data-today-next]'), later: later.getBoundingClientRect().top };
      }, `List second ${tag}`);
      expect(order.next).toBeLessThan(order.later);

      // Switched on, the arc comes back in its place.
      const arcOn = TODAY_TEMPLATE.widgets.map((w) => (w.i === 'calendar' ? { ...w, settings: { ...(w.settings ?? {}), arc: true } } : w));
      await page.request.patch(`/api/layouts/${layout.id}`, { data: { widgets: arcOn } });
      await page.reload();
      await expect(page.locator('[data-today-arc]')).toHaveCount(1, { timeout: 60_000 });
      await expect(page.locator('[data-today-list="wall"]')).toHaveCount(0);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });

  test('the parts panel hides a part and sets the days ahead', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const d = new Date();
    const made: string[] = [];
    for (const days of [1, 2]) {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 10);
      const r = await postEvent(page, { title: `Parts day ${days} ${Date.now()}`, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() });
      made.push((await r.json()).id);
    }
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Parts e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'today' } })).json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-today-chores], [data-today-coming]').first().waitFor({ timeout: 60_000 });
      await page.locator('[data-dock-menu]').click();
      await page.locator('[data-dock-more]').click();
      await page.locator('[data-dock-more-panel] [data-screen-job="edit"]').click();
      const panel = page.locator('[data-today-parts]');
      await expect(panel).toBeVisible();
      await expect(page.locator('.widget-cell'), 'no grid while editing Today').toHaveCount(0);
      await panel.locator('[data-part-show="chores"]').click();
      await panel.locator('[data-days-ahead]').selectOption('1');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('[data-today-scene]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-today-chores]'), 'chores hidden').toHaveCount(0);
      await expect(page.locator('[data-today-coming] dt'), 'one day ahead').toHaveCount(1);
      await expect(page.locator('[data-today-coming] dt').first()).toHaveText('Tomorrow');
      const saved = await (await page.request.get(`/api/layouts/${layout.id}`)).json();
      const parts = (saved.layout ?? saved).widgets as Array<{ i: string; visible?: boolean; settings?: { daysAhead?: number } }>;
      expect(parts.find((p) => p.i === 'chores')?.visible).toBe(false);
      expect(parts.find((p) => p.i === 'calendar')?.settings?.daysAhead).toBe(1);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });

  // #931: the Calendar starting layout.
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    test(`the Calendar layout: today widest, nothing under the floor, week and month, an event opens its sheet, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page);
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 10);
      const title = `Board check ${Date.now()}`;
      const ev = await postEvent(page, { title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, createdBy: getSeededParentId() });
      const event = await ev.json();
      const layout = await (await page.request.post('/api/layouts', { data: { name: `Board e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'calendar' } })).json();
      try {
        await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
        await page.goto(`/d/${layout.slug}`);
        await page.locator('[data-board-week]').waitFor({ timeout: 60_000 });
        const m = await page.evaluate(() => {
          const cols = [...document.querySelectorAll('[data-board-week] > [data-board-day]')].map((c) => ({ w: c.getBoundingClientRect().width, today: c.hasAttribute('data-board-today') }));
          const probe = document.createElement('div'); probe.style.fontSize = 'var(--text-floor)'; document.body.appendChild(probe);
          const floor = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
          const texts = [...document.querySelectorAll('[data-calendar-board] *')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim());
          return {
            cols,
            small: texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) < floor - 0.01).length,
            cut: [...document.querySelectorAll('[data-board-event]')].filter((el) => el.scrollWidth > el.clientWidth + 1).length,
          };
        });
        expect(m.cols).toHaveLength(7);
        const todayCol = m.cols.find((c) => c.today)!;
        for (const c of m.cols.filter((c) => !c.today)) expect(todayCol.w, 'today is the widest column').toBeGreaterThan(c.w);
        expect(m.small, 'text under the floor').toBe(0);
        expect(m.cut, 'event text cut').toBe(0);

        await page.locator('[data-board-event]').filter({ hasText: title }).click();
        await expect(page.locator('[data-event-sheet]').getByRole('heading', { name: title })).toBeVisible();
        await page.locator('[data-event-sheet] [data-sheet-close]').click();

        await page.locator('[data-board-switch="month"]').click();
        await expect(page.locator('[data-calendar-board]')).toHaveAttribute('data-board-mode', 'month');
        await expect(page.locator('[data-board-month] [data-board-today]')).toHaveCount(1);
      } finally {
        await page.request.delete(`/api/layouts/${layout.id}`);
        await page.request.delete(`/api/events/${event.id}`);
      }
    });
  }
  // #993: a busy day on the month board shows what fits, measured, and no count.
  test('the month board shows as many of a busy day\'s events as fit, and no "+N more"', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const d = new Date();
    const made: string[] = [];
    test.setTimeout(150_000);
    // Within the events limit (30 a minute), and far more than a month cell holds.
    for (let i = 0; i < 16; i++) {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6 + Math.floor(i / 2), (i % 2) * 30);
      const res = await postEvent(page, { title: `Crowded ${i + 1}`, startTime: start.toISOString(), endTime: new Date(start.getTime() + 20 * 60_000).toISOString(), allDay: false, createdBy: getSeededParentId() });
      expect(res.status()).toBe(201);
      made.push((await res.json()).id);
    }
    const layout = await (await page.request.post('/api/layouts', { data: { name: `Crowded e2e ${Date.now()}`, widgets: TODAY_TEMPLATE.widgets, view: 'calendar' } })).json();
    try {
      await page.route('**/api/weather*', (route) => route.fulfill({ json: WEATHER }));
      await page.goto(`/d/${layout.slug}`);
      await page.locator('[data-board-week]').waitFor({ timeout: 60_000 });
      await page.locator('[data-board-switch="month"]').click();
      const cell = page.locator('[data-board-month] [data-board-today]');
      await expect(cell).toHaveCount(1);
      await page.waitForTimeout(500);
      const m = await cell.evaluate((el) => {
        const c = el.getBoundingClientRect();
        const lines = [...el.children].slice(1) as HTMLElement[];
        return {
          text: el.textContent ?? '',
          shown: lines.length,
          inside: lines.every((l) => { const r = l.getBoundingClientRect(); return r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5; }),
          board: document.querySelector('[data-calendar-board]')?.textContent ?? '',
        };
      });
      expect(m.board, 'no "more" count on the board').not.toMatch(/\+\s*\d+|\bmore\b/i);
      expect(m.shown, 'some of the day is shown').toBeGreaterThan(0);
      expect(m.shown).toBeLessThan(16);
      expect(m.inside, 'every line shown sits fully inside its day').toBe(true);
    } finally {
      await page.request.delete(`/api/layouts/${layout.id}`);
      for (const id of made) await page.request.delete(`/api/events/${id}`);
    }
  });
});
