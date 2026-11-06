import { test, expect, type Page } from '@playwright/test';
import { getSeededParentId } from './helpers/auth';

/**
 * Per-calendar display rules (#877): a calendar shown only as Busy never
 * sends its titles; a birthdays calendar reads as name and age; and a
 * calendar hidden after 11:00 has today's events gone at 11:01 and back the
 * next morning.
 */
const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';

async function login(page: Page) {
  expect((await page.request.post('/api/auth/login', { data: { userId: getSeededParentId(), pin: process.env.E2E_PIN || '1234' } })).ok()).toBe(true);
}

/** A local calendar, its rules set for the test and put back after. */
async function withRules(page: Page, rules: Record<string, unknown>, run: (calendarId: string) => Promise<void>) {
  const list = await (await page.request.get('/api/calendars')).json();
  const cal = (list.calendars ?? list).find((c: { provider: string; enabled: boolean }) => c.provider === 'local' && c.enabled);
  expect(cal, 'a local calendar to try the rules on').toBeTruthy();
  const before = cal.displayRules ?? null;
  expect((await page.request.patch(`/api/calendars/${cal.id}`, { data: { displayRules: rules } })).ok()).toBe(true);
  try {
    await run(cal.id);
  } finally {
    await page.request.patch(`/api/calendars/${cal.id}`, { data: { displayRules: before } });
  }
}

async function addEvent(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post('/api/events', { data: { createdBy: getSeededParentId(), ...data } });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}

async function listed(page: Page, from: Date, to: Date) {
  const res = await page.request.get(`/api/events?startDate=${from.toISOString()}&endDate=${to.toISOString()}&limit=500`);
  return (await res.json()).events as Array<{ id: string; title: string; description: string | null; location: string | null }>;
}

test.describe('per-calendar display rules', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('a calendar shown as Busy never sends its title, description or place', async ({ page }) => {
    await login(page);
    await withRules(page, { busyOnly: true }, async (calendarId) => {
      const start = new Date(); start.setHours(15, 0, 0, 0);
      const id = await addEvent(page, {
        title: `Private ${Date.now()}`, description: 'not for the wall', location: 'Somewhere',
        startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, calendarSourceId: calendarId,
      });
      try {
        const ev = (await listed(page, new Date(start.getTime() - 86_400_000), new Date(start.getTime() + 86_400_000))).find((e) => e.id === id)!;
        expect(ev).toMatchObject({ title: 'Busy', description: null, location: null });
      } finally { await page.request.delete(`/api/events/${id}`); }
    });
  });

  test('a birthdays calendar reads as name and age', async ({ page }) => {
    await login(page);
    const name = `Zed${Date.now() % 100000}`;
    const birthday = await (await page.request.post('/api/birthdays', { data: { name, birthDate: '2016-12-20' } })).json();
    try {
      await withRules(page, { birthdays: true }, async (calendarId) => {
        const id = await addEvent(page, {
          title: `${name}'s birthday`, startTime: '2026-12-20T00:00:00.000Z', endTime: '2026-12-21T00:00:00.000Z', allDay: true, calendarSourceId: calendarId,
        });
        try {
          const ev = (await listed(page, new Date('2026-12-19T00:00:00Z'), new Date('2026-12-22T00:00:00Z'))).find((e) => e.id === id)!;
          expect(ev.title).toBe(`${name}, 10`);
        } finally { await page.request.delete(`/api/events/${id}`); }
      });
    } finally {
      await page.request.delete(`/api/birthdays/${birthday.id}`);
    }
  });

  test('a calendar hidden after 11:00: gone at 11:01, back the next morning', async ({ page }) => {
    await login(page);
    await withRules(page, { hideAfter: '11:00' }, async (calendarId) => {
      // Bin day today and tomorrow, all day.
      const day = new Date(); day.setHours(0, 0, 0, 0);
      const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const title = `Bin day ${Date.now()}`;
      const tomorrow = new Date(day); tomorrow.setDate(day.getDate() + 1);
      const after = new Date(day); after.setDate(day.getDate() + 2);
      const id = await addEvent(page, {
        title, startTime: `${key(day)}T00:00:00.000Z`, endTime: `${key(tomorrow)}T00:00:00.000Z`, allDay: true, calendarSourceId: calendarId,
      });
      const id2 = await addEvent(page, {
        title, startTime: `${key(tomorrow)}T00:00:00.000Z`, endTime: `${key(after)}T00:00:00.000Z`, allDay: true, calendarSourceId: calendarId,
      });
      try {
        await page.addInitScript(() => localStorage.setItem('prism-calendar-view-type', 'agenda'));
        const at = async (h: number, m: number, plusDays = 0) => {
          const t = new Date(day); t.setDate(day.getDate() + plusDays); t.setHours(h, m, 0, 0);
          await page.clock.setFixedTime(t);
          await page.goto('/calendar');
          await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 });
          await page.waitForTimeout(1500);
          return page.getByText(title).count();
        };
        expect(await at(10, 59), 'there before 11:00').toBeGreaterThan(0);
        expect(await at(11, 1, 0) < (await at(10, 59)), 'today\'s is gone at 11:01').toBe(true);
        expect(await at(8, 0, 1), 'the next morning, back').toBeGreaterThan(0);
      } finally {
        await page.request.delete(`/api/events/${id}`);
        await page.request.delete(`/api/events/${id2}`);
      }
    });
  });
});

// An event Google replaced (an edited series gets new ids) left its old copy
// flagged pending deletion beside the new one, so the screen showed it twice
// and Hide hid only one (#1047). The old copy stays out while its live twin is
// there, hidden or not; one with no twin still shows until reviewed.
test.describe('an event replaced at its source', () => {
  test.skip(!HAS_TEST_DB, 'needs the seeded test database');
  test.setTimeout(90_000);

  test('shows once, stays once when hidden, and shows when nothing replaced it', async ({ page }) => {
    const { runSQL } = await import('./helpers/reset');
    await login(page);
    const list = await (await page.request.get('/api/calendars')).json();
    const cal = (list.calendars ?? list).find((c: { provider: string; enabled: boolean }) => c.provider === 'local' && c.enabled);
    const start = new Date(); start.setDate(start.getDate() + 3); start.setHours(16, 0, 0, 0);
    const title = `Replaced ${Date.now()}`;
    const data = { title, startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600_000).toISOString(), allDay: false, calendarSourceId: cal.id };
    const oldId = await addEvent(page, data);
    const newId = await addEvent(page, data);
    // Events are cached per range for 5 minutes; a sync clears that, the SQL
    // below does not, so each look asks for a range a millisecond longer.
    let look = 0;
    const ids = async () => (await listed(page, new Date(start.getTime() - 86_400_000), new Date(start.getTime() + 86_400_000 + ++look)))
      .filter((e) => e.title === title).map((e) => e.id).sort();
    try {
      expect(await ids(), 'premise: both show before the flag').toEqual([oldId, newId].sort());
      runSQL(`update events set pending_deletion = now() where id = '${oldId}';`);
      expect(await ids(), 'the old copy is out while the new one is there').toEqual([newId]);
      expect((await page.request.put(`/api/events/${newId}/hidden`)).ok()).toBe(true);
      expect(await ids(), 'hiding the new one does not bring the old one back').toEqual([]);
      await page.request.delete(`/api/events/${newId}/hidden`);
      runSQL(`update events set pending_deletion = now() where id = '${newId}';`);
      expect(await ids(), 'with both flagged, both show until reviewed').toEqual([oldId, newId].sort());
    } finally {
      runSQL(`update events set pending_deletion = null where id in ('${oldId}', '${newId}');`);
      await page.request.delete(`/api/events/${oldId}`);
      await page.request.delete(`/api/events/${newId}`);
    }
  });
});
