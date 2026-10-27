/**
 * @jest-environment jsdom
 */
/**
 * A named screen's side of settings sync (#690): it sends what changed on the
 * screen, takes what was changed elsewhere, and says so, against a stand-in
 * server that merges the way the real route does.
 */
import { loadBase, hasLocalChanges, syncScreenSettings, resetSyncBase } from '../displaySettingsSync';
import { mergeSettings, type ScreenSettings } from '../screenSettings';

const KITCHEN = '22222222-2222-4222-8222-222222222222';
const HALL = '33333333-3333-4333-8333-333333333333';

// The stand-in server: one screen's row.
let row: { id: string; dashboardId: string | null; settings: ScreenSettings; updatedAt: string | null };
let requests: Array<{ changes: Record<string, string | null>; baseDisplayId: string | null }>;
let status = 200;

beforeEach(() => {
  localStorage.clear();
  row = { id: KITCHEN, dashboardId: null, settings: {}, updatedAt: null };
  requests = [];
  status = 200;
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    if (status !== 200) return { ok: false, status } as Response;
    const firstSync = body.baseDisplayId !== row.id;
    const adopting = firstSync && Object.keys(row.settings).length > 0;
    if (!adopting && Object.keys(body.changes).length > 0) {
      row.settings = mergeSettings(row.settings, body.changes);
      row.updatedAt = new Date().toISOString();
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ displayId: row.id, dashboardId: row.dashboardId, settings: row.settings, settingsUpdatedAt: row.updatedAt }),
    } as Response;
  }) as jest.Mock;
});

describe('syncScreenSettings', () => {
  it('a newly named screen sends everything it has, and the row takes it', async () => {
    localStorage.setItem('prism-screensaver-timeout', '300');
    localStorage.setItem('prism-perf-mode', 'true');
    localStorage.setItem('prism-theme', 'dark');

    const result = await syncScreenSettings();
    expect(requests[0]).toEqual({
      changes: { 'prism-screensaver-timeout': '300', 'prism-perf-mode': 'true' },
      baseDisplayId: null,
    });
    expect(row.settings).toEqual({ 'prism-screensaver-timeout': '300', 'prism-perf-mode': 'true' });
    expect(result).toEqual({ applied: [], dashboardChanged: false });
    expect(loadBase()?.displayId).toBe(KITCHEN);
    expect(hasLocalChanges()).toBe(false);
  });

  it('afterwards sends only what changed on the screen', async () => {
    localStorage.setItem('prism-screensaver-timeout', '300');
    await syncScreenSettings();

    localStorage.setItem('prism-screensaver-drift', 'off');
    localStorage.removeItem('prism-screensaver-timeout');
    expect(hasLocalChanges()).toBe(true);
    await syncScreenSettings();
    expect(requests[1]).toEqual({
      changes: { 'prism-screensaver-timeout': null, 'prism-screensaver-drift': 'off' },
      baseDisplayId: KITCHEN,
    });
    expect(row.settings).toEqual({ 'prism-screensaver-drift': 'off' });
  });

  it('takes an edit made from another device, without undoing its own', async () => {
    localStorage.setItem('prism-screensaver-timeout', '300');
    await syncScreenSettings();

    row.settings = { ...row.settings, 'prism-perf-mode': 'true' }; // edited from a phone
    localStorage.setItem('prism-screensaver-drift', 'off'); // edited on the screen

    const result = await syncScreenSettings();
    expect(result.applied).toEqual(['prism-perf-mode']);
    expect(localStorage.getItem('prism-perf-mode')).toBe('true');
    expect(row.settings).toEqual({
      'prism-screensaver-timeout': '300', 'prism-perf-mode': 'true', 'prism-screensaver-drift': 'off',
    });
  });

  it('a browser taking over a screen gets its settings, and its own are not sent up', async () => {
    row.settings = { 'prism-screensaver-timeout': '600', 'prism-orientation-override': 'portrait' };
    localStorage.setItem('prism-screensaver-timeout', '60');
    localStorage.setItem('prism-perf-mode', 'true');

    const result = await syncScreenSettings();
    expect(row.settings).toEqual({ 'prism-screensaver-timeout': '600', 'prism-orientation-override': 'portrait' });
    expect(localStorage.getItem('prism-screensaver-timeout')).toBe('600');
    expect(localStorage.getItem('prism-orientation-override')).toBe('portrait');
    expect(localStorage.getItem('prism-perf-mode')).toBeNull();
    expect(result.applied.sort()).toEqual(
      ['prism-orientation-override', 'prism-perf-mode', 'prism-screensaver-timeout'],
    );
  });

  it('a base left from another screen counts as a first sync', async () => {
    localStorage.setItem('prism-screensaver-timeout', '60');
    row.id = HALL;
    await syncScreenSettings();
    expect(loadBase()?.displayId).toBe(HALL);

    row.id = KITCHEN;
    row.settings = { 'prism-screensaver-timeout': '600' };
    await syncScreenSettings();
    expect(requests[1]!.baseDisplayId).toBe(HALL);
    expect(localStorage.getItem('prism-screensaver-timeout')).toBe('600');
  });

  it('notices a dashboard changed elsewhere, but not on the first sync', async () => {
    row.dashboardId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect((await syncScreenSettings()).dashboardChanged).toBe(false);
    row.dashboardId = null;
    expect((await syncScreenSettings()).dashboardChanged).toBe(true);
    expect((await syncScreenSettings()).dashboardChanged).toBe(false);
  });

  it('forgets its base when the screen no longer exists', async () => {
    await syncScreenSettings();
    expect(loadBase()).not.toBeNull();
    status = 404;
    expect(await syncScreenSettings()).toEqual({ applied: [], dashboardChanged: false });
    expect(loadBase()).toBeNull();
  });

  it('resetSyncBase makes the next sync a first one', async () => {
    await syncScreenSettings();
    resetSyncBase();
    await syncScreenSettings();
    expect(requests[1]!.baseDisplayId).toBeNull();
  });
});
