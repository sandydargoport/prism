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
import { createContext, useContext, useEffect, useState } from 'react';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { isInstallableTheme, type Theme } from '@/lib/themes/tokens';
import { BUILTIN_THEMES, getBuiltinTheme, DEFAULT_THEME_ID } from '@/lib/themes/appThemes';
import { applyThemeVars, themeTokens } from '@/lib/themes/applyTheme';

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

/**
 * Get the system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [installedThemes, setInstalledThemes] = useState<Theme[]>([]);
  const [palette, setPaletteState] = useState<Theme>(
    () => getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!,
  );

  // On mount, load saved theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  // Apply theme to document and resolve system theme
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Determine the actual theme to apply
    let actualTheme: 'light' | 'dark';
    if (theme === 'system') {
      actualTheme = getSystemTheme();
    } else {
      actualTheme = theme;
    }

    // Apply or remove dark class
    if (actualTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    setResolvedTheme(actualTheme);
  }, [theme, mounted]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);

      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  // Update theme and persist to localStorage
  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  // Persisted to the database rather than localStorage, because a palette is a
  // household choice: every screen in the house should agree, and a new tablet
  // should pick it up without being configured.
  const setPalette = (id: string) => {
    const next = getBuiltinTheme(id) ?? installedThemes.find((t) => t.id === id);
    if (!next) return;
    setPaletteState(next);
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: THEME_SETTING_KEY, value: { mode: theme, paletteId: id } }),
    }).catch(() => { /* applied locally; the next load falls back to the server value */ });
  };

  // Apply the palette's variables whenever it or the light/dark mode changes.
  //
  // Runs after mount only. The first paint is handled by a stylesheet rendered
  // on the server, so this effect is for changes rather than for load — which
  // is why there is no flash when someone picks a palette.
  useEffect(() => {
    if (!mounted) return;
    applyThemeVars(document.documentElement, themeTokens(palette, resolvedTheme));
  }, [palette, resolvedTheme, mounted]);

  // Escape hatch for a kiosk that cannot reach Settings: ?theme=default resets
  // the palette and persists it. A wall display has no keyboard, and a palette
  // with a broken background/foreground pair makes the Settings page itself
  // unreadable — which would otherwise mean an SSH session to recover.
  // Mirrors ?perf=0 in usePerformanceMode, which exists for the same reason.
  useEffect(() => {
    if (!mounted) return;
    if (new URLSearchParams(window.location.search).get('theme') !== 'default') return;
    const fallback = getBuiltinTheme(DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]!;
    setPaletteState(fallback);
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: THEME_SETTING_KEY, value: { mode: theme, paletteId: fallback.id } }),
    }).catch(() => { /* reset locally at least; the display is usable again */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Read the stored palette once. A failure here is not worth surfacing: the
  // server already rendered a palette, so the visible result of the request
  // never arriving is that the picker shows the default.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const stored = data.settings?.[THEME_SETTING_KEY];

        // Themes installed from the gallery are stored inline rather than
        // fetched, so a display that boots without a network still renders the
        // palette it was left on. Re-validated on read: the row is written by
        // an API that checks, but this is the last point before it becomes CSS
        // and the check costs a regex per token.
        const installed = Array.isArray(stored?.installed)
          ? (stored.installed as unknown[]).filter(isInstallableTheme)
          : [];
        if (installed.length > 0) setInstalledThemes(installed);

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

  // Prevent flash of wrong theme during SSR
  // Return null or a loading state until mounted
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{ theme: defaultTheme, resolvedTheme: 'light', setTheme, palette, palettes: [...BUILTIN_THEMES, ...installedThemes], setPalette }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, palette, palettes: [...BUILTIN_THEMES, ...installedThemes], setPalette }}
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
