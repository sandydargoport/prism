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

import { NextRequest } from 'next/server';
import { POST } from '../current/settings/route';

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
  mockApply.mockImplementation(async (_id: string, changes: Record<string, string>) => ({
    settings: changes,
    settingsUpdatedAt: UPDATED,
  }));
});

const screen = (settings: Record<string, string>) => ({
  id: KITCHEN, name: 'Kitchen', dashboardId: null, settings, settingsUpdatedAt: null,
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
    const res = await post({ changes: { 'prism-theme': 'dark' }, baseDisplayId: KITCHEN });
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
      settings: { 'prism-screensaver-drift': 'off' },
      settingsUpdatedAt: UPDATED.toISOString(),
    });
  });

  it('a newly named screen with nothing stored takes the browser\'s settings', async () => {
    mockCurrentDisplay.mockResolvedValue(screen({}));
    await post({ changes: { 'prism-screensaver-timeout': '300' }, baseDisplayId: null });
    expect(mockApply).toHaveBeenCalledWith(KITCHEN, { 'prism-screensaver-timeout': '300' });
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
