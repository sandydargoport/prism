/** @jest-environment jsdom */
/**
 * Editing a screen from a phone (#1153): inside the frame, the screen's
 * settings are read and written in the host, and nothing the frame writes
 * reaches the phone's own storage.
 */
import { changedSettings, installRemoteStorage, releaseHeldSettings, REMOTE_EDIT_GLOBAL, remoteStorage, resetRemoteEditHost, type RemoteEditHost } from '../remoteEdit';
import { writeStored } from '@/lib/hooks/useStoredValue';
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

describe('a device nobody has named, editing its own dashboard (#1341)', () => {
  const own = (settings: Record<string, string>): RemoteEditHost => ({ ...host(settings), displayId: null });
  beforeEach(() => localStorage.clear());

  it('holds its screen settings in the host, so nothing reaches the browser before Done', () => {
    localStorage.setItem('prism-perf-mode', 'full');
    const h = own({ 'prism-perf-mode': 'full' });
    const store = remoteStorage(localStorage, h);
    store.setItem('prism-perf-mode', 'minimal');
    store.removeItem('prism-theme');
    expect(store.getItem('prism-perf-mode')).toBe('minimal');
    expect(h.settings['prism-perf-mode']).toBe('minimal');
    expect(localStorage.getItem('prism-perf-mode')).toBe('full');
  });

  it('writes everything else to its own storage, and is its own device to the sync code', () => {
    const store = remoteStorage(localStorage, own({}));
    store.setItem('prism-screensaver-layout', '[]');
    expect(localStorage.getItem('prism-screensaver-layout')).toBe('[]');
    // Naming it from the editor still works: the sync base is its own.
    store.setItem('prism:display-sync-base', '{"displayId":"new"}');
    expect(localStorage.getItem('prism:display-sync-base')).toBe('{"displayId":"new"}');
    expect(store.getItem('prism:display-sync-base')).toBe('{"displayId":"new"}');
  });

  it('gets the layer in the frame, as a named screen does', () => {
    const h = own({ 'prism-perf-mode': 'full' });
    const parent = { [REMOTE_EDIT_GLOBAL]: h };
    const realParent = Object.getOwnPropertyDescriptor(window, 'parent');
    const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
    resetRemoteEditHost();
    try {
      installRemoteStorage();
      window.localStorage.setItem('prism-perf-mode', 'minimal');
      expect(h.settings['prism-perf-mode']).toBe('minimal');
    } finally {
      if (realParent) Object.defineProperty(window, 'parent', realParent);
      else delete (window as { parent?: unknown }).parent;
      if (realStorage) Object.defineProperty(window, 'localStorage', realStorage);
      else delete (window as { localStorage?: unknown }).localStorage;
      resetRemoteEditHost();
    }
    expect(window.localStorage.getItem('prism-perf-mode')).toBeNull();
  });

  /** Runs `fn` as the editor's frame, with `parent` as the editor page's window. */
  function asFrame(parent: object | null, fn: (real: Storage) => void) {
    const real = window.localStorage;
    const realParent = Object.getOwnPropertyDescriptor(window, 'parent');
    const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
    resetRemoteEditHost();
    try {
      installRemoteStorage();
      fn(real);
    } finally {
      if (realParent) Object.defineProperty(window, 'parent', realParent);
      if (realStorage) Object.defineProperty(window, 'localStorage', realStorage);
      else delete (window as { localStorage?: unknown }).localStorage;
      resetRemoteEditHost();
    }
  }

  it('a normal page, not the editor, keeps the settings the sync writes in this browser', () => {
    asFrame(null, (real) => {
      // No layer: the page's storage is the browser's own.
      expect(window.localStorage).toBe(real);
      writeStored('prism-screensaver-timeout', '600');
      releaseHeldSettings();
    });
    expect(localStorage.getItem('prism-screensaver-timeout')).toBe('600');
  });

  it('named from the editor, it lets them go: the settings of a screen named before land in this browser', () => {
    const h = own({ 'prism-perf-mode': 'full' });
    asFrame({ [REMOTE_EDIT_GLOBAL]: h }, (real) => {
      writeStored('prism-perf-mode', 'minimal');
      expect(real.getItem('prism-perf-mode')).toBeNull();
      // NameThisDevice, once the server has named it, before it syncs.
      releaseHeldSettings();
      expect(real.getItem('prism-perf-mode')).toBe('minimal');
      // What the sync then writes, the screen's own settings, reaches the browser.
      writeStored('prism-screensaver-timeout', '600');
      expect(real.getItem('prism-screensaver-timeout')).toBe('600');
      expect(window.localStorage.getItem('prism-screensaver-timeout')).toBe('600');
    });
    expect(localStorage.getItem('prism-screensaver-timeout')).toBe('600');
  });

  it('a named screen being edited is never let go', () => {
    const h = host({});
    asFrame({ [REMOTE_EDIT_GLOBAL]: h }, (real) => {
      releaseHeldSettings();
      writeStored('prism-screensaver-timeout', '600');
      expect(real.getItem('prism-screensaver-timeout')).toBeNull();
      expect(h.settings['prism-screensaver-timeout']).toBe('600');
    });
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
