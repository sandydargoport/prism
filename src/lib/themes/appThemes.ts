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


/**
 * Seasonal, and named after a feeling rather than anything anyone owns. The
 * naming matters as much as the colours: a palette called after a franchise is
 * installed for the name, and that is the part that attracts a takedown.
 */
const HARVEST: Theme = {
  id: 'harvest',
  name: 'Harvest',
  description: 'Late autumn. Amber, bark and a low sun.',
  light: {
    background: '38 40% 97%',
    foreground: '25 35% 16%',
    card: '38 45% 99%',
    'card-foreground': '25 35% 16%',
    popover: '38 45% 99%',
    'popover-foreground': '25 35% 16%',
    primary: '24 62% 33%',
    'primary-foreground': '38 45% 98%',
    secondary: '36 35% 90%',
    'secondary-foreground': '25 35% 16%',
    muted: '36 30% 91%',
    'muted-foreground': '28 20% 38%',
    accent: '30 45% 86%',
    'accent-foreground': '25 35% 16%',
    destructive: '0 65% 40%',
    'destructive-foreground': '38 45% 98%',
    border: '34 28% 82%',
    input: '34 28% 82%',
    ring: '24 62% 33%',
  },
  dark: {
    background: '26 24% 10%',
    foreground: '38 30% 93%',
    card: '26 22% 14%',
    'card-foreground': '38 30% 93%',
    popover: '26 22% 14%',
    'popover-foreground': '38 30% 93%',
    primary: '32 70% 60%',
    'primary-foreground': '26 24% 10%',
    secondary: '26 18% 20%',
    'secondary-foreground': '38 30% 93%',
    muted: '26 18% 20%',
    'muted-foreground': '36 18% 68%',
    accent: '26 20% 24%',
    'accent-foreground': '38 30% 93%',
    destructive: '0 55% 45%',
    'destructive-foreground': '38 30% 93%',
    border: '26 16% 26%',
    input: '26 16% 26%',
    ring: '32 70% 60%',
  },
};

const SNOW_DAY: Theme = {
  id: 'snow-day',
  name: 'Snow Day',
  description: 'Cold light and pale blue. Quiet, and easy to read.',
  light: {
    background: '205 40% 98%',
    foreground: '215 40% 15%',
    card: '0 0% 100%',
    'card-foreground': '215 40% 15%',
    popover: '0 0% 100%',
    'popover-foreground': '215 40% 15%',
    primary: '205 60% 32%',
    'primary-foreground': '205 40% 98%',
    secondary: '205 35% 92%',
    'secondary-foreground': '215 40% 15%',
    muted: '205 30% 93%',
    'muted-foreground': '212 20% 40%',
    accent: '198 45% 88%',
    'accent-foreground': '215 40% 15%',
    destructive: '355 65% 42%',
    'destructive-foreground': '205 40% 98%',
    border: '205 25% 85%',
    input: '205 25% 85%',
    ring: '205 60% 32%',
  },
  dark: {
    background: '215 40% 10%',
    foreground: '205 35% 95%',
    card: '215 36% 14%',
    'card-foreground': '205 35% 95%',
    popover: '215 36% 14%',
    'popover-foreground': '205 35% 95%',
    primary: '199 75% 65%',
    'primary-foreground': '215 40% 10%',
    secondary: '215 28% 20%',
    'secondary-foreground': '205 35% 95%',
    muted: '215 28% 20%',
    'muted-foreground': '205 20% 70%',
    accent: '215 30% 24%',
    'accent-foreground': '205 35% 95%',
    destructive: '355 55% 48%',
    'destructive-foreground': '205 35% 95%',
    border: '215 24% 27%',
    input: '215 24% 27%',
    ring: '199 75% 65%',
  },
};

/**
 * The look of a 16-bit console, not any particular one. Saturated primaries on
 * near-black, which is what the hardware of the era could actually produce —
 * a period, like Art Deco, rather than anyone's property. No franchise name,
 * no character colours, no logo.
 */
const ARCADE: Theme = {
  id: 'arcade',
  name: 'Arcade',
  description: 'Sixteen-bit console. Saturated primaries on near-black.',
  light: {
    background: '240 20% 96%',
    foreground: '245 45% 14%',
    card: '0 0% 100%',
    'card-foreground': '245 45% 14%',
    popover: '0 0% 100%',
    'popover-foreground': '245 45% 14%',
    primary: '265 62% 40%',
    'primary-foreground': '240 25% 98%',
    secondary: '240 25% 90%',
    'secondary-foreground': '245 45% 14%',
    muted: '240 20% 91%',
    'muted-foreground': '245 18% 38%',
    accent: '190 55% 84%',
    'accent-foreground': '245 45% 14%',
    destructive: '350 70% 42%',
    'destructive-foreground': '240 25% 98%',
    border: '240 18% 84%',
    input: '240 18% 84%',
    ring: '265 62% 40%',
  },
  dark: {
    background: '248 45% 8%',
    foreground: '190 60% 92%',
    card: '248 40% 13%',
    'card-foreground': '190 60% 92%',
    popover: '248 40% 13%',
    'popover-foreground': '190 60% 92%',
    primary: '285 85% 70%',
    'primary-foreground': '248 45% 8%',
    secondary: '248 32% 19%',
    'secondary-foreground': '190 60% 92%',
    muted: '248 32% 19%',
    'muted-foreground': '210 25% 70%',
    accent: '175 70% 45%',
    'accent-foreground': '248 45% 8%',
    destructive: '350 75% 55%',
    'destructive-foreground': '248 45% 8%',
    border: '248 28% 26%',
    input: '248 28% 26%',
    ring: '285 85% 70%',
  },
};

export const BUILTIN_THEMES: Theme[] = [PRISM, CLAY, HARVEST, SNOW_DAY, ARCADE];

export function getBuiltinTheme(id: string): Theme | undefined {
  return BUILTIN_THEMES.find((t) => t.id === id);
}
