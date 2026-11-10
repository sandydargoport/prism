/** @jest-environment jsdom */
/**
 * Editing a screen from a phone (#1153): inside the frame, the screen's
 * settings are read and written in the host, and nothing the frame writes
 * reaches the phone's own storage.
 */
import { changedSettings, remoteStorage, type RemoteEditHost } from '../remoteEdit';
import { screenSummary } from '../screenSummary';

function host(settings: Record<string, string>): RemoteEditHost {
  return {
    displayId: 'kitchen', dashboardId: null, settings: { ...settings }, settingsUpdatedAt: null,
    root: {} as HTMLElement, onDashboard: jest.fn(), onFinish: jest.fn(),
  };
}

describe('remoteStorage', () => {
  beforeEach(() => localStorage.clear());

  it('answers the screen\'s settings and keeps writes to them in the host', () => {
    localStorage.setItem('prism-screensaver-timeout', '30');
    const h = host({ 'prism-screensaver-timeout': '120' });
    const store = remoteStorage(localStorage, h);
    expect(store.getItem('prism-screensaver-timeout')).toBe('120');
    store.setItem('prism-screensaver-timeout', '3600');
    store.removeItem('prism-screensaver-dim');
    expect(h.settings['prism-screensaver-timeout']).toBe('3600');
    // The phone's own value is untouched.
    expect(localStorage.getItem('prism-screensaver-timeout')).toBe('30');
  });

  it('keeps other writes in memory and reads through for the rest', () => {
    localStorage.setItem('theme', 'dark');
    const store = remoteStorage(localStorage, host({}));
    expect(store.getItem('theme')).toBe('dark');
    store.setItem('prism-screensaver-layout', '[]');
    store.removeItem('theme');
    expect(store.getItem('prism-screensaver-layout')).toBe('[]');
    expect(store.getItem('theme')).toBeNull();
    expect(localStorage.getItem('prism-screensaver-layout')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('is the edited screen to the sync code, never the phone\'s own', () => {
    localStorage.setItem('prism:display-sync-base', JSON.stringify({ displayId: 'phone', settings: {} }));
    const store = remoteStorage(localStorage, host({ 'prism-perf-mode': 'full' }));
    expect(JSON.parse(store.getItem('prism:display-sync-base')!)).toMatchObject({ displayId: 'kitchen', settings: { 'prism-perf-mode': 'full' } });
  });
});

describe('changedSettings', () => {
  it('lists the screen settings that changed, null for one removed', () => {
    expect(changedSettings(
      { 'prism-screensaver-timeout': '120', 'prism-screensaver-dim': '0.5' },
      { 'prism-screensaver-timeout': '3600', 'prism-perf-mode': 'full' },
    )).toEqual({ 'prism-screensaver-timeout': '3600', 'prism-screensaver-dim': null, 'prism-perf-mode': 'full' });
  });
});

describe('screenSummary', () => {
  const clock = (t: string) => t;
  it('says when it rests, when night is and how many Interludes', () => {
    expect(screenSummary({}, { source: 'photos' }, clock)).toBe('Rests after 2 min, night from dusk');
    expect(screenSummary(
      { 'prism-screensaver-timeout': '0', 'prism-screen-schedule': JSON.stringify([{ dashboardId: 'x', days: [1], from: '07:00', to: '08:00' }]) },
      { day: 'dashboard', night: 'off', switch: { by: 'clock', from: '21:00', to: '06:30' } },
      clock,
    )).toBe('Never rests, night 21:00 to 06:30, 1 Interlude');
    expect(screenSummary({ 'prism-screensaver-timeout': '3600' }, null, clock)).toBe('Rests after 1 hour');
  });
});
