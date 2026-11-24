/**
 * A screen saving its own settings (#690): only a named screen can, only known
 * screen settings are accepted, and a browser syncing with a screen for the
 * first time takes the screen's stored settings rather than overwriting them.
 */
const mockCurrentDisplay = jest.fn();
const mockApply = jest.fn();
const mockSetCookies = jest.fn();

jest.mock('next/headers', () => ({ cookies: async () => ({}) }));
jest.mock('@/lib/auth/displayIdentity', () => ({
  currentDisplay: () => mockCurrentDisplay(),
  setDisplayCookies: (...a: unknown[]) => mockSetCookies(...a),
}));
jest.mock('@/lib/displays/displaySettingsStore', () => ({
  applySettingChanges: (...a: unknown[]) => mockApply(...a),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
// The household's starting day (#1345), as a new install seeds it.
const mockHouseholdDay = jest.fn();
jest.mock('@/lib/displays/startingDay', () => ({
  ...jest.requireActual('@/lib/displays/startingDay'),
  readHouseholdDay: () => mockHouseholdDay(),
}));

import { NextRequest } from 'next/server';
import { POST } from '../current/settings/route';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';
import { serializeScreenDay, type ScreenDay } from '@/lib/screenDay';

const HOUSEHOLD: ScreenDay = { day: 'dashboard', night: 'dashboard', switch: DEFAULT_NIGHT, nightLevel: 50 };

const KITCHEN = '22222222-2222-4222-8222-222222222222';
const HALL = '33333333-3333-4333-8333-333333333333';
const UPDATED = new Date('2026-10-27T18:00:00Z');

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/displays/current/settings', {
    method: 'POST',
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  jest.clearAllMocks();
  mockHouseholdDay.mockResolvedValue(HOUSEHOLD);
  mockApply.mockImplementation(async (_id: string, changes: Record<string, string>) => ({
    settings: changes,
    settingsUpdatedAt: UPDATED,
  }));
});

const screen = (settings: Record<string, string>) => ({
  id: KITCHEN, name: 'Kitchen', dashboardId: null, switches: [], settings, settingsUpdatedAt: null,
});

describe('POST /api/displays/current/settings', () => {
  it('answers 404 and clears the cookies for a browser that is not a named screen', async () => {
    mockCurrentDisplay.mockResolvedValue(null);
    const res = await post({ changes: {}, baseDisplayId: null });
    expect(res.status).toBe(404);
    expect(mockSetCookies).toHaveBeenCalledWith(expect.anything(), null, false);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('refuses a key that is not a screen setting', async () => {
    mockCurrentDisplay.mockResolvedValue(screen({}));
    const res = await post({ changes: { 'prism:timezone': 'Europe/Paris' }, baseDisplayId: KITCHEN });
    expect(res.status).toBe(400);
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('saves the screen\'s changes and returns the stored settings', async () => {
    mockCurrentDisplay.mockResolvedValue(screen({ 'prism-perf-mode': 'true' }));
    const res = await post({ changes: { 'prism-screensaver-drift': 'off' }, baseDisplayId: KITCHEN });
    expect(mockApply).toHaveBeenCalledWith(KITCHEN, { 'prism-screensaver-drift': 'off' });
    const body = await res.json();
    expect(body).toEqual({
      displayId: KITCHEN,
      dashboardId: null,
      switches: [],
      settings: { 'prism-screensaver-drift': 'off' },
      settingsUpdatedAt: UPDATED.toISOString(),
    });
  });

  it('a newly named screen with nothing stored takes the browser\'s settings', async () => {
    mockCurrentDisplay.mockResolvedValue(screen({}));
    await post({ changes: { 'prism-screensaver-timeout': '300' }, baseDisplayId: null });
    expect(mockApply).toHaveBeenCalledWith(KITCHEN, expect.objectContaining({ 'prism-screensaver-timeout': '300' }));
  });

  describe('a newly named screen copies its day once (#1345)', () => {
    it('writes the household\'s starting day, 50% darker on a new install, when the browser had none', async () => {
      mockCurrentDisplay.mockResolvedValue(screen({}));
      await post({ changes: {}, baseDisplayId: null });
      expect(mockApply).toHaveBeenCalledWith(KITCHEN, { 'prism-screen-day': serializeScreenDay(HOUSEHOLD) });
    });

    it('carries up a browser\'s old dim value as the night level, and drops the old key', async () => {
      mockCurrentDisplay.mockResolvedValue(screen({}));
      await post({ changes: { 'prism-screensaver-dim': '0.25' }, baseDisplayId: null });
      expect(mockApply).toHaveBeenCalledWith(KITCHEN, {
        'prism-screen-day': serializeScreenDay({ ...HOUSEHOLD, nightLevel: 25 }),
      });
    });

    it('carries up a day the browser set for itself as it is', async () => {
      const own = serializeScreenDay({ day: 'photos', night: 'off', switch: DEFAULT_NIGHT, nightLevel: 0 });
      mockCurrentDisplay.mockResolvedValue(screen({}));
      await post({ changes: { 'prism-screen-day': own }, baseDisplayId: null });
      expect(mockApply).toHaveBeenCalledWith(KITCHEN, { 'prism-screen-day': own });
    });

    it('leaves a screen that already has settings, and later syncs, alone', async () => {
      mockCurrentDisplay.mockResolvedValue(screen({ 'prism-perf-mode': 'true' }));
      await post({ changes: {}, baseDisplayId: null });
      await post({ changes: { 'prism-perf-mode': 'false' }, baseDisplayId: KITCHEN });
      expect(mockApply).toHaveBeenCalledTimes(1);
      expect(mockApply).toHaveBeenCalledWith(KITCHEN, { 'prism-perf-mode': 'false' });
      expect(mockHouseholdDay).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['has never synced', null],
    ['last synced with another screen', HALL],
  ])('a browser that %s does not overwrite a screen\'s stored settings', async (_label, baseDisplayId) => {
    mockCurrentDisplay.mockResolvedValue(screen({ 'prism-screensaver-timeout': '600' }));
    const res = await post({ changes: { 'prism-screensaver-timeout': '60' }, baseDisplayId });
    expect(mockApply).not.toHaveBeenCalled();
    expect((await res.json()).settings).toEqual({ 'prism-screensaver-timeout': '600' });
  });
});
