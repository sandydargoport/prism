import type { Page } from '@playwright/test';
import type { IdleBackground } from '../../src/lib/idleBackground';

/**
 * A timeline of the test's own that this browser follows (#1266).
 *
 * How a screen rests and its night belong to the timeline it follows; a
 * browser nobody named follows the household's first. A test that changes
 * them would change them for every other test, so it gets its own: created
 * here, put first in the list this page reads (the list the server keeps is
 * left as it is), and removed by `cleanup`. Changes the page makes go to it,
 * and `saved` reads it back as stored.
 *
 * Needs a parent signed in on `page.request` first.
 */
export type OwnTimeline = {
  id: string;
  saved: () => Promise<{ id: string; name: string; dashboardId: string | null; placements: unknown[]; idleBackground: IdleBackground }>;
  cleanup: () => Promise<void>;
};

export async function ownTimeline(page: Page, idleBackground?: IdleBackground): Promise<OwnTimeline> {
  const res = await page.request.post('/api/timelines', { data: { name: `e2e ${Date.now()} ${Math.random().toString(36).slice(2, 6)}` } });
  if (!res.ok()) throw new Error(`precondition: could not add a timeline (${res.status()})`);
  const { timeline } = await res.json() as { timeline: { id: string } };
  const id = timeline.id;
  if (idleBackground) {
    const patched = await page.request.patch(`/api/timelines/${id}`, { data: { idleBackground } });
    if (!patched.ok()) throw new Error(`precondition: could not set the timeline's rest (${patched.status()})`);
  }
  await page.route('**/api/timelines', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const json = await response.json() as { timelines?: Array<{ id: string; position: number }> };
    const list = (json.timelines ?? []).map((t) => (t.id === id ? { ...t, position: -1 } : t));
    list.sort((a, b) => a.position - b.position);
    return route.fulfill({ response, json: { timelines: list } });
  });
  return {
    id,
    saved: async () => {
      const all = await (await page.request.get('/api/timelines')).json() as { timelines: Array<{ id: string }> };
      return all.timelines.find((t) => t.id === id) as Awaited<ReturnType<OwnTimeline['saved']>>;
    },
    cleanup: async () => { await page.request.delete(`/api/timelines/${id}`); },
  };
}
