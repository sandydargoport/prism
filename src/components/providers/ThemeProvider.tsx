/**
 *
 * Manages dark/light mode theming throughout the application.
 * Persists user preference to localStorage and respects system preference.
 *
 * HOW IT WORKS:
 * 1. On mount, checks localStorage for saved preference
 * 2. If "system", listens for OS dark mode changes
 * 3. Applies "dark" class to <html> element when dark mode is active
 * 4. Provides context for components to read/change theme
 *
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { useHydrated, useStoredString, writeStored } from '@/lib/hooks/useStoredValue';
import { isInstallableTheme, MAX_INSTALLED_THEMES, type Theme } from '@/lib/themes/tokens';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from '@/lib/themes/appThemes';
import { applyThemeVars, applyThemeChrome, themeTokens } from '@/lib/themes/applyTheme';

/**
 * Theme modes
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Theme context value
 */
interface ThemeContextValue {
  /** Current theme setting (light, dark, or system) */
  theme: ThemeMode;
  /** Resolved theme (light or dark - what's actually shown) */
  resolvedTheme: 'light' | 'dark';
  /** Update the theme */
  setTheme: (theme: ThemeMode) => void;
  /** Which palette is applied. Independent of light/dark. */
  palette: Theme;
  /** Every palette that can be chosen right now. */
  palettes: Theme[];
  /** Switch palette. Persisted to the settings row, not to localStorage. */
  setPalette: (id: string) => void;
  /** The subset of `palettes` that came from the gallery rather than the box. */
  installedThemes: Theme[];
  /**
   * Add a gallery theme and switch to it.
   *
   * Installing and applying are one operation because the API validates them
   * as one: `paletteId` has to name a builtin or a theme present in the same
   * write, so there is no request that installs without choosing.
   *
   * Resolves false when the write was refused, so the caller can say so rather
   * than showing an install that vanishes on the next load.
   */
  installTheme: (theme: Theme) => Promise<boolean>;
  /** Remove a gallery theme, falling back to the default if it was in use. */
  uninstallTheme: (id: string) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Storage key for persisting theme preference
 */
const STORAGE_KEY = 'prism-theme';

/**
 * The settings row holding the chosen palette. Seeded since the beginning and
 * read by nothing until now — the `{ mode }` shape it was seeded with is kept
 * so existing rows stay valid.
 */
const THEME_SETTING_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Whether the system is in dark mode, following it as it changes. */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    subscribeSystemTheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

function isThemeMode(v: string | null): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system';
}

/**
 * Theme Provider Props
 */
interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if none is stored */
  defaultTheme?: ThemeMode;
}

/**
 * THEME PROVIDER COMPONENT
 * Wrap your app with this provider to enable theming.
 *
 * @example
 * <ThemeProvider defaultTheme="system">
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  // The mode is per display, in localStorage; the palette below is per
  // household, in the database. Both are the server's defaults while hydrating.
  const storedMode = useStoredString(STORAGE_KEY);
  const theme: ThemeMode = isThemeMode(storedMode) ? storedMode : defaultTheme;
  const systemDark = useSystemDark();
  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const mounted = useHydrated();
  const [installedThemes, setInstalledThemes] = useState<Theme[]>([]);
  const [palette, setPaletteState] = useState<Theme>(
    () => getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!,
  );
  // A ref rather than an effect event: persistTheme is called from event
  // handlers as well as the load effect.
  const themeRef = useLatestRef(theme);

  // Apply the light/dark class. Not while hydrating: the inline script in
  // app/layout.tsx already set it from the same stored value before the first
  // paint, and the server's 'light' would take it off for a frame.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme, mounted]);

  // Update theme and persist to localStorage
  const setTheme = (newTheme: ThemeMode) => writeStored(STORAGE_KEY, newTheme);

  // Persisted to the database rather than localStorage, because a palette is a
  // household choice: every screen in the house should agree, and a new tablet
  // should pick it up without being configured.
  //
  // Always writes all three fields. The settings row is replaced wholesale
  // rather than merged, so a write that names only `paletteId` deletes the
  // installed themes — and because the API requires `paletteId` to name a
  // builtin or a theme in the same write, such a write is also rejected
  // outright the moment a gallery palette is the one being chosen.
  const persistTheme = async (paletteId: string, installed: Theme[]): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Read through a ref, not the closure. The load effect runs once and
          // persists from inside its own response handler, where the captured
          // `theme` is still the pre-mount default — writing it back would
          // reset the row's mode as a side effect of reading it.
          key: THEME_SETTING_KEY,
          value: { mode: themeRef.current, paletteId, installed },
        }),
      });
      return res.ok;
    } catch {
      return false; // applied locally; the next load falls back to the server value
    }
  };

  const setPalette = (id: string) => {
    const next = getBuiltinTheme(id) ?? installedThemes.find((t) => t.id === id);
    if (!next) return;
    setPaletteState(next);
    void persistTheme(id, installedThemes);
  };

  const installTheme = async (incoming: Theme): Promise<boolean> => {
    // Re-validated here even though the gallery validated on fetch: this is the
    // last point before the value is handed to a row that gets rendered into a
    // <style> element on the server.
    if (!isInstallableTheme(incoming)) return false;
    // A builtin id would shadow a palette everyone already has, and the
    // resolver checks builtins first, so the installed copy would be dead data.
    if (getBuiltinTheme(incoming.id)) return false;

    const next = [...installedThemes.filter((t) => t.id !== incoming.id), incoming];
    // The API refuses more than 40. Refusing here too means the caller gets a
    // reason rather than a 400 it has to interpret.
    if (next.length > MAX_INSTALLED_THEMES) return false;

    const ok = await persistTheme(incoming.id, next);
    if (!ok) return false;
    setInstalledThemes(next);
    setPaletteState(incoming);
    return true;
  };

  const uninstallTheme = async (id: string): Promise<boolean> => {
    const next = installedThemes.filter((t) => t.id !== id);
    if (next.length === installedThemes.length) return false;

    // Removing the palette in use would leave `paletteId` naming a theme that
    // is no longer in the write, which the API rejects. Fall back first.
    const fallback = getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!;
    const nextPaletteId = palette.id === id ? fallback.id : palette.id;

    const ok = await persistTheme(nextPaletteId, next);
    if (!ok) return false;
    setInstalledThemes(next);
    if (palette.id === id) setPaletteState(fallback);
    return true;
  };

  // Apply the palette's variables whenever it or the light/dark mode changes.
  //
  // Runs after mount only. The first paint is handled by a stylesheet rendered
  // on the server, so this effect is for changes rather than for load — which
  // is why there is no flash when someone picks a palette.
  useEffect(() => {
    if (!mounted) return;
    applyThemeVars(document.documentElement, themeTokens(palette, resolvedTheme));
    applyThemeChrome(document.documentElement, palette);
  }, [palette, resolvedTheme, mounted]);

  // Read the stored palette once. A failure here is not worth surfacing: the
  // server already rendered a palette, so the visible result of the request
  // never arriving is that the picker shows the default.
  //
  // The ?theme=default escape hatch is handled inside this same read rather
  // than in an effect of its own. It has to rewrite the row, the row is
  // replaced wholesale, and the installed themes it must carry over are only
  // known once this response arrives — resetting from a separate effect raced
  // the read and wrote back an empty `installed`, uninstalling every gallery
  // theme in the house as the price of fixing one unreadable palette.
  const persistOnLoad = useEffectEvent((id: string, installed: Theme[]) => persistTheme(id, installed));
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const stored = data?.settings?.[THEME_SETTING_KEY];

        // Themes installed from the gallery are stored inline rather than
        // fetched, so a display that boots without a network still renders the
        // palette it was left on. Re-validated on read: the row is written by
        // an API that checks, but this is the last point before it becomes CSS
        // and the check costs a regex per token.
        const installed = Array.isArray(stored?.installed)
          ? (stored.installed as unknown[])
              .filter(isInstallableTheme)
              // A row written before installTheme existed, or by hand, can hold
              // a theme sharing a builtin's id. The resolver checks builtins
              // first, so the copy is unreachable data — and leaving it in
              // `palettes` renders two cards with the same id.
              .filter((t) => !getBuiltinTheme(t.id))
          : [];
        if (installed.length > 0) setInstalledThemes(installed);

        // Escape hatch for a kiosk that cannot reach Settings. A wall display
        // has no keyboard, and a palette with a broken background/foreground
        // pair makes the Settings page itself unreadable — which would
        // otherwise mean an SSH session to recover. Mirrors ?perf=0 in
        // usePerformanceMode, which exists for the same reason.
        if (new URLSearchParams(window.location.search).get('theme') === 'default') {
          const fallback = getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!;
          setPaletteState(fallback);
          void persistOnLoad(fallback.id, installed);
          return;
        }

        const id = typeof stored?.paletteId === 'string' ? stored.paletteId : null;
        const found = id ? (getBuiltinTheme(id) ?? installed.find((t) => t.id === id)) : undefined;
        if (found) setPaletteState(found);
      })
      .catch(() => { /* keep whatever the server rendered */ });
    return () => { cancelled = true; };
  }, []);

  // Apply seasonal theme CSS variables globally.
  //
  // Passed the resolved mode so it does not have to watch the html class list
  // to discover it. Its four --seasonal-* properties are deliberately outside
  // THEME_TOKENS, so the two writers never touch the same property.
  useSeasonalTheme(resolvedTheme);
  // Apply performance-mode class on <html> from localStorage preference
  usePerformanceMode();

  return (
    <ThemeContext.Provider
      value={{
        theme, resolvedTheme, setTheme, palette,
        palettes: [...BUILTIN_THEMES, ...installedThemes], setPalette,
        installedThemes, installTheme, uninstallTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * USE THEME HOOK
 * Access the current theme and setTheme function from any component.
 *
 * @example
 * const { theme, setTheme, resolvedTheme } = useTheme();
 * setTheme('dark'); // Switch to dark mode
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
