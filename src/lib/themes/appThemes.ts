/**
 * Themes that ship with Prism.
 *
 * `prism` carries the exact values that lived in globals.css, so the default
 * look is a theme like any other rather than a special case the rest of the
 * code has to work around.
 */
import type { Theme } from './tokens';

export const DEFAULT_THEME_ID = 'prism';

const PRISM: Theme = {
  id: 'prism',
  name: 'Prism',
  description: 'The original. Cool blues on a clean surface.',
  light: {
    background: '0 0% 100%',
    foreground: '222 47% 11%',
    card: '0 0% 100%',
    'card-foreground': '222 47% 11%',
    popover: '0 0% 100%',
    'popover-foreground': '222 47% 11%',
    primary: '222 47% 31%',
    'primary-foreground': '210 40% 98%',
    secondary: '210 40% 96%',
    'secondary-foreground': '222 47% 11%',
    muted: '210 40% 96%',
    'muted-foreground': '215 16% 47%',
    accent: '210 40% 96%',
    'accent-foreground': '222 47% 11%',
    destructive: '0 84% 60%',
    'destructive-foreground': '210 40% 98%',
    border: '214 32% 91%',
    input: '214 32% 91%',
    ring: '222 47% 31%',
  },
  dark: {
    background: '222 47% 11%',
    foreground: '210 40% 98%',
    card: '222 47% 15%',
    'card-foreground': '210 40% 98%',
    popover: '222 47% 15%',
    'popover-foreground': '210 40% 98%',
    primary: '210 40% 98%',
    'primary-foreground': '222 47% 11%',
    secondary: '217 33% 17%',
    'secondary-foreground': '210 40% 98%',
    muted: '217 33% 17%',
    'muted-foreground': '215 20% 65%',
    accent: '217 33% 17%',
    'accent-foreground': '210 40% 98%',
    destructive: '0 62% 30%',
    'destructive-foreground': '210 40% 98%',
    border: '217 33% 25%',
    input: '217 33% 25%',
    ring: '212 95% 68%',
  },
};

/**
 * Warm, low-contrast neutrals. Built as a second theme mainly to prove the
 * mechanism works on something that is not a tint of the default — if only
 * `prism` existed, nothing would exercise the swap.
 */
const CLAY: Theme = {
  id: 'clay',
  name: 'Clay',
  description: 'Warm earth tones. Easier on the eyes in a bright kitchen.',
  light: {
    background: '30 25% 97%',
    foreground: '25 20% 18%',
    card: '30 30% 99%',
    'card-foreground': '25 20% 18%',
    popover: '30 30% 99%',
    'popover-foreground': '25 20% 18%',
    primary: '18 42% 38%',
    'primary-foreground': '30 30% 98%',
    secondary: '30 20% 92%',
    'secondary-foreground': '25 20% 18%',
    muted: '30 20% 92%',
    'muted-foreground': '25 12% 45%',
    accent: '30 20% 90%',
    'accent-foreground': '25 20% 18%',
    destructive: '4 70% 47%',
    'destructive-foreground': '30 30% 98%',
    border: '30 18% 86%',
    input: '30 18% 86%',
    ring: '18 42% 38%',
  },
  dark: {
    background: '25 18% 12%',
    foreground: '30 20% 94%',
    card: '25 18% 16%',
    'card-foreground': '30 20% 94%',
    popover: '25 18% 16%',
    'popover-foreground': '30 20% 94%',
    primary: '22 55% 62%',
    'primary-foreground': '25 18% 12%',
    secondary: '25 14% 22%',
    'secondary-foreground': '30 20% 94%',
    muted: '25 14% 22%',
    'muted-foreground': '30 12% 65%',
    accent: '25 14% 24%',
    'accent-foreground': '30 20% 94%',
    destructive: '4 55% 42%',
    'destructive-foreground': '30 20% 94%',
    border: '25 14% 28%',
    input: '25 14% 28%',
    ring: '22 55% 62%',
  },
};

export const BUILTIN_THEMES: Theme[] = [PRISM, CLAY];

export function getBuiltinTheme(id: string): Theme | undefined {
  return BUILTIN_THEMES.find((t) => t.id === id);
}
