/**
 * @jest-environment jsdom
 */

/**
 * The line at the foot of Settings > Appearance says where one screen's own
 * settings are (#1159): in that screen's editor, opened from More > Edit
 * layout (#1313). It used to say to press Edit at the bottom of the screen,
 * which is no longer there.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

let mockWallpaperOn = false;
const swatch = { background: '0 0% 100%', card: '0 0% 100%', primary: '0 0% 0%', accent: '0 0% 50%', destructive: '0 80% 50%' };

jest.mock('@/components/providers', () => ({
  useTheme: () => ({
    theme: 'light', setTheme: jest.fn(), resolvedTheme: 'light',
    palette: { id: 'paper', name: 'Paper', description: '', light: swatch, dark: swatch },
    palettes: [], setPalette: jest.fn(), installedThemes: [],
  }),
}));
jest.mock('@/components/providers/LocaleProvider', () => ({
  APP_LOCALES: [{ value: 'en', label: 'English' }],
  useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }),
}));
jest.mock('@/lib/hooks/useSeasonalTheme', () => ({ useSeasonalTheme: () => ({ seasonalTheme: 'none', setSeasonalTheme: jest.fn(), palette: null }) }));
jest.mock('@/components/settings/ThemeShareDialog', () => ({ ThemeShareDialog: () => null }));
jest.mock('@/components/settings/CommunityThemeGallery', () => ({ CommunityThemeGallery: () => null }));
jest.mock('@/components/settings/ThemeImportButton', () => ({ ThemeImportButton: () => null }));
jest.mock('@/components/layout/WallpaperBackground', () => ({
  useWallpaperSettings: () => ({ enabled: mockWallpaperOn, setEnabled: jest.fn(), interval: 15, setInterval: jest.fn() }),
  useAutoOrientationSetting: () => ({ enabled: false, setEnabled: jest.fn() }),
}));
jest.mock('@/lib/hooks/useAwayModeTimeout', () => ({ useAwayModeTimeout: () => ({ timeout: 0, setTimeout: jest.fn(), ready: true, error: null }) }));

import { DisplaySection, NewScreensStartAs } from '../DisplaySection';

beforeEach(() => {
  // The household cards read their values; none of them matter here.
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});
afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

describe('Appearance: where one screen\'s settings are', () => {
  it('names More > Edit layout, not an Edit button at the bottom of the screen', () => {
    const { container } = render(<DisplaySection />);
    const note = container.querySelector('[data-screen-settings-moved]')!;
    expect(note.textContent).toContain('in that screen\'s editor: choose More > Edit layout on the screen');
    expect(note.textContent).not.toMatch(/bottom of the screen|editing bar/);
    expect(note.querySelector('a')!.getAttribute('href')).toBe('/settings?section=displays');
  });
});

// #1351: captions and On this day are in Settings > Photos, not behind the wallpaper switch.
describe('Appearance: photo captions', () => {
  afterEach(() => { mockWallpaperOn = false; });

  it('are not in the wallpaper card, with the wallpaper on or off', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ settings: {} }) })) as unknown as typeof fetch;
    mockWallpaperOn = true;
    render(<DisplaySection />);
    await act(async () => {});
    expect(screen.getByText('Rotate every')).toBeTruthy();
    expect(screen.queryByText('Show when photos were taken')).toBeNull();
    expect(screen.queryByText('Show where photos were taken')).toBeNull();
    expect(screen.queryByText('On this day')).toBeNull();
  });
});

// #1340: light or dark is the screen's own, and the household has a starting value.
describe('Appearance: light or dark', () => {
  afterEach(() => {
    document.cookie = 'prism_display_named=; max-age=0';
  });

  it('on a named screen offers Light and Dark only, and says it is kept with the screen', () => {
    document.cookie = 'prism_display_named=1';
    const { container } = render(<DisplaySection />);
    const group = screen.getByRole('group', { name: 'Light or dark' });
    expect(group.textContent).toBe('LightDark');
    expect(container.querySelector('[data-color-scheme-scope]')!.textContent).toContain('this screen, kept with it');
  });

  it('on a browser nobody named also offers System, for this browser', () => {
    const { container } = render(<DisplaySection />);
    expect(screen.getByRole('group', { name: 'Light or dark' }).textContent).toBe('LightDarkSystem');
    expect(container.querySelector('[data-color-scheme-scope]')!.textContent).toBe('Light or dark for this browser.');
  });

  it('never says light and dark are per screen or that the night sky is set on each screen', () => {
    const { container } = render(<DisplaySection />);
    expect(container.textContent).not.toMatch(/per-screen|set on each screen/);
  });

  it('New screens start as shows the household value and saves Light or Dark to it', async () => {
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => (init?.method === 'PATCH' ? {} : { settings: { defaultThemeMode: 'dark' } }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<NewScreensStartAs />);
    const dark = await screen.findByRole('button', { name: 'Dark' });
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Light' })); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({ method: 'PATCH' })));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ key: 'defaultThemeMode', value: 'light' });
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
  });
});
