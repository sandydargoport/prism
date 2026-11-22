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
    displayId: 'kitchen', dashboardId: null, switches: [], settings: { ...settings }, settingsUpdatedAt: null,
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
  it('says what it shows and when it switches, then when it rests (#1282)', () => {
    expect(screenSummary({}, 'Shows Kitchen, School run at bus time')).toBe('Shows Kitchen, School run at bus time, rests after 2 min');
    expect(screenSummary({ 'prism-screensaver-timeout': '0' }, 'Shows Kitchen')).toBe('Shows Kitchen, never rests');
    expect(screenSummary({ 'prism-screensaver-timeout': '3600' }, null)).toBe('Rests after 1 hour');
  });

  it('leaves night out: each dashboard has its own (#1281)', () => {
    expect(screenSummary({}, 'Shows Kitchen')).not.toMatch(/night/);
  });
});
