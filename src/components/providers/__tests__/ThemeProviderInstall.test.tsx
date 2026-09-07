/**
 * @jest-environment jsdom
 *
 * Installing, keeping and removing gallery themes.
 *
 * The case worth pinning is that every write carries the whole set. The
 * settings row is replaced rather than merged, so a write that names only
 * `paletteId` deletes the installed themes — which meant that installing a
 * theme and then switching to a built-in one silently uninstalled everything
 * the household had collected, with no error and nothing visible until the
 * next reload.
 */

import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { THEME_TOKENS, type Theme, type ThemeTokens } from '@/lib/themes/tokens';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

/** Every token the same legal triple: these tests are about bookkeeping, not colour. */
const tokens = (triple: string): ThemeTokens =>
  Object.fromEntries(THEME_TOKENS.map((t) => [t, triple])) as ThemeTokens;

const galleryTheme = (id: string): Theme => ({
  id,
  name: `Theme ${id}`,
  description: 'From the gallery.',
  light: tokens('30 40% 96%'),
  dark: tokens('220 30% 12%'),
});

/** The body of the last PATCH to /api/settings. */
function lastWrite(fetchMock: jest.Mock) {
  const patches = fetchMock.mock.calls.filter((c) => c[1]?.method === 'PATCH');
  return JSON.parse(patches[patches.length - 1]![1].body);
}

describe('ThemeProvider — gallery themes', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.clear();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  /** Initial GET, then every later PATCH succeeds. */
  const respondWith = (settings: Record<string, unknown>) => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === 'PATCH'
        ? Promise.resolve({ ok: true, json: async () => ({}) })
        : Promise.resolve({ ok: true, json: async () => ({ settings }) }),
    );
  };

  it('installs a theme and applies it', async () => {
    respondWith({ theme: { mode: 'system', paletteId: 'prism' } });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.installTheme(galleryTheme('dusk')); });

    expect(ok).toBe(true);
    expect(result.current.palette.id).toBe('dusk');
    expect(result.current.installedThemes.map((t) => t.id)).toEqual(['dusk']);
    expect(result.current.palettes.some((p) => p.id === 'dusk')).toBe(true);
  });

  it('keeps installed themes when switching to a built-in palette', async () => {
    respondWith({
      theme: { mode: 'system', paletteId: 'dusk', installed: [galleryTheme('dusk')] },
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(result.current.installedThemes).toHaveLength(1));

    await act(async () => { result.current.setPalette('clay'); });

    await waitFor(() => expect(lastWrite(fetchMock).value.paletteId).toBe('clay'));
    // The regression: this used to be absent, and the API replaces the row.
    expect(lastWrite(fetchMock).value.installed).toHaveLength(1);
    expect(result.current.installedThemes).toHaveLength(1);
  });

  it('sends the palette and the theme in one write, as the API requires', async () => {
    respondWith({ theme: { mode: 'system', paletteId: 'prism' } });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await act(async () => { await result.current.installTheme(galleryTheme('dusk')); });

    const { value } = lastWrite(fetchMock);
    expect(value.paletteId).toBe('dusk');
    expect(value.installed.some((t: Theme) => t.id === 'dusk')).toBe(true);
  });

  it('refuses a theme whose colours are not legal triples', async () => {
    respondWith({ theme: { mode: 'system', paletteId: 'prism' } });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const bad = { ...galleryTheme('bad'), light: tokens('red; } body { display:none') };
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.installTheme(bad); });

    expect(ok).toBe(false);
    expect(result.current.installedThemes).toHaveLength(0);
  });

  it('refuses to shadow a built-in id', async () => {
    respondWith({ theme: { mode: 'system', paletteId: 'prism' } });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.installTheme(galleryTheme('clay')); });

    expect(ok).toBe(false);
    expect(result.current.installedThemes).toHaveLength(0);
  });

  it('does not record an install the server refused', async () => {
    fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
      init?.method === 'PATCH'
        ? Promise.resolve({ ok: false, json: async () => ({ error: 'Invalid installed theme' }) })
        : Promise.resolve({ ok: true, json: async () => ({ settings: { theme: { paletteId: 'prism' } } }) }),
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.installTheme(galleryTheme('dusk')); });

    // Showing it as installed would be a lie the next reload corrects.
    expect(ok).toBe(false);
    expect(result.current.installedThemes).toHaveLength(0);
    expect(result.current.palette.id).toBe('prism');
  });

  it('falls back to the default when removing the palette in use', async () => {
    respondWith({
      theme: { mode: 'system', paletteId: 'dusk', installed: [galleryTheme('dusk')] },
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(result.current.palette.id).toBe('dusk'));

    await act(async () => { await result.current.uninstallTheme('dusk'); });

    expect(result.current.palette.id).toBe('prism');
    expect(result.current.installedThemes).toHaveLength(0);
    // The removed theme must not still be named as the palette, or the API
    // rejects the write for naming a palette that is not in it.
    const { value } = lastWrite(fetchMock);
    expect(value.paletteId).toBe('prism');
    expect(value.installed).toHaveLength(0);
  });

  it('leaves the palette alone when removing one that is not in use', async () => {
    respondWith({
      theme: {
        mode: 'system',
        paletteId: 'dusk',
        installed: [galleryTheme('dusk'), galleryTheme('moss')],
      },
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    await waitFor(() => expect(result.current.installedThemes).toHaveLength(2));

    await act(async () => { await result.current.uninstallTheme('moss'); });

    expect(result.current.palette.id).toBe('dusk');
    expect(result.current.installedThemes.map((t) => t.id)).toEqual(['dusk']);
  });

  it('keeps installed themes when ?theme=default rescues an unreadable palette', async () => {
    // The kiosk escape hatch. It rewrites the row, so it has to carry the
    // installed set — resetting used to race the read and write back an empty
    // list, uninstalling every gallery theme to fix one bad palette.
    const url = new URL(window.location.href);
    url.searchParams.set('theme', 'default');
    window.history.replaceState({}, '', url);

    respondWith({
      theme: { mode: 'system', paletteId: 'dusk', installed: [galleryTheme('dusk')] },
    });
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => expect(result.current.palette.id).toBe('prism'));
    await waitFor(() => expect(lastWrite(fetchMock).value.paletteId).toBe('prism'));
    expect(lastWrite(fetchMock).value.installed).toHaveLength(1);
    expect(result.current.installedThemes).toHaveLength(1);

    window.history.replaceState({}, '', '/');
  });
});
