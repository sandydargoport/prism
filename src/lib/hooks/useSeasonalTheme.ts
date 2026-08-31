'use client';

import { useState, useEffect, useCallback } from 'react';
import { seasonalPalettes, type SeasonalThemeKey } from '@/lib/themes/seasonalThemes';

const STORAGE_KEY = 'prism-seasonal-theme';

function getCurrentMonth(): number {
  return new Date().getMonth() + 1; // 1-12
}

function loadSetting(): SeasonalThemeKey {
  if (typeof window === 'undefined') return 'auto';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'none' || stored === 'auto') return stored;
  const num = Number(stored);
  if (num >= 1 && num <= 12) return num;
  return 'auto';
}

function applySeasonalVars(month: number | null, isDark: boolean) {
  const root = document.documentElement;
  const vars = ['--seasonal-accent', '--seasonal-accent-foreground', '--seasonal-highlight', '--seasonal-subtle'];

  if (month === null) {
    // Remove seasonal vars (revert to defaults in CSS)
    vars.forEach((v) => root.style.removeProperty(v));
    return;
  }

  const palette = seasonalPalettes[month];
  if (!palette) return;

  const colors = isDark ? palette.dark : palette.light;
  root.style.setProperty('--seasonal-accent', colors.accent);
  root.style.setProperty('--seasonal-accent-foreground', colors.accentForeground);
  root.style.setProperty('--seasonal-highlight', colors.highlight);
  root.style.setProperty('--seasonal-subtle', colors.subtle);
}

export function useSeasonalTheme(mode?: 'light' | 'dark') {
  const [setting, setSetting] = useState<SeasonalThemeKey>(loadSetting);

  const activeMonth: number | null =
    setting === 'none' ? null :
    setting === 'auto' ? getCurrentMonth() :
    setting;

  const setSeasonalTheme = useCallback((value: SeasonalThemeKey) => {
    setSetting(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  // Apply CSS variables whenever setting or dark mode changes
  useEffect(() => {
    // When the caller already knows the mode — ThemeProvider does, it is React
    // state there — take it directly. The observer below is the fallback for
    // callers that do not, and it fires on every class change on <html>,
    // including the performance-mode toggle and anything else that writes
    // there. Skipping it removes a MutationObserver from a display that runs
    // for weeks.
    if (mode) {
      applySeasonalVars(activeMonth, mode === 'dark');
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    applySeasonalVars(activeMonth, isDark);

    // Observe dark class changes to re-apply with correct variant
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      applySeasonalVars(activeMonth, dark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, [activeMonth, mode]);

  return {
    seasonalTheme: setting,
    activeMonth,
    setSeasonalTheme,
    palette: activeMonth ? seasonalPalettes[activeMonth] : null,
  };
}
