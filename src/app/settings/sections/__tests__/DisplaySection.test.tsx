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
import { render } from '@testing-library/react';

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
  useWallpaperSettings: () => ({ enabled: false, setEnabled: jest.fn(), interval: 15, setInterval: jest.fn() }),
  useAutoOrientationSetting: () => ({ enabled: false, setEnabled: jest.fn() }),
}));
jest.mock('@/lib/hooks/useAwayModeTimeout', () => ({ useAwayModeTimeout: () => ({ timeout: 0, setTimeout: jest.fn(), ready: true, error: null }) }));

import { DisplaySection } from '../DisplaySection';

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
