/**
 * Seasonal color themes for Prism dashboard.
 * Each month defines accent/highlight/subtle colors in HSL format (without hsl() wrapper)
 * with light and dark variants.
 */

export interface SeasonalPalette {
  name: string;
  label: string;
  light: {
    accent: string;
    accentForeground: string;
    highlight: string;
    subtle: string;
  };
  dark: {
    accent: string;
    accentForeground: string;
    highlight: string;
    subtle: string;
  };
}

export type SeasonalThemeKey = number | 'auto' | 'none';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const seasonalPalettes: Record<number, SeasonalPalette> = {
  1: {
    name: 'winter',
    label: 'January',
    light: {
      accent: '200 80% 50%',
      accentForeground: '0 0% 100%',
      highlight: '210 15% 75%',
      subtle: '200 40% 95%',
    },
    dark: {
      accent: '200 70% 55%',
      accentForeground: '0 0% 100%',
      highlight: '210 15% 45%',
      subtle: '200 30% 15%',
    },
  },
  2: {
    name: 'valentine',
    label: 'February',
    light: {
      accent: '340 80% 60%',
      accentForeground: '0 0% 100%',
      highlight: '350 70% 40%',
      subtle: '340 40% 95%',
    },
    dark: {
      accent: '340 70% 55%',
      accentForeground: '0 0% 100%',
      highlight: '350 60% 35%',
      subtle: '340 30% 15%',
    },
  },
  3: {
    name: 'stpatrick',
    label: 'March',
    light: {
      accent: '150 70% 40%',
      accentForeground: '0 0% 100%',
      highlight: '45 80% 50%',
      subtle: '150 30% 95%',
    },
    dark: {
      accent: '150 60% 45%',
      accentForeground: '0 0% 100%',
      highlight: '45 70% 45%',
      subtle: '150 25% 15%',
    },
  },
  4: {
    name: 'easter',
    label: 'April',
    light: {
      accent: '280 50% 65%',
      accentForeground: '0 0% 100%',
      highlight: '50 70% 60%',
      subtle: '280 30% 95%',
    },
    dark: {
      accent: '280 45% 55%',
      accentForeground: '0 0% 100%',
      highlight: '50 60% 45%',
      subtle: '280 25% 15%',
    },
  },
  5: {
    name: 'spring',
    label: 'May',
    light: {
      accent: '120 50% 45%',
      accentForeground: '0 0% 100%',
      highlight: '330 60% 65%',
      subtle: '120 30% 95%',
    },
    dark: {
      accent: '120 45% 45%',
      accentForeground: '0 0% 100%',
      highlight: '330 50% 50%',
      subtle: '120 25% 15%',
    },
  },
  6: {
    name: 'summer',
    label: 'June',
    light: {
      accent: '45 90% 50%',
      accentForeground: '0 0% 10%',
      highlight: '195 80% 50%',
      subtle: '45 40% 95%',
    },
    dark: {
      accent: '45 80% 50%',
      accentForeground: '0 0% 10%',
      highlight: '195 70% 45%',
      subtle: '45 30% 15%',
    },
  },
  7: {
    name: 'independence',
    label: 'July',
    light: {
      accent: '220 80% 50%',
      accentForeground: '0 0% 100%',
      highlight: '0 80% 50%',
      subtle: '220 30% 95%',
    },
    dark: {
      accent: '220 70% 55%',
      accentForeground: '0 0% 100%',
      highlight: '0 70% 45%',
      subtle: '220 25% 15%',
    },
  },
  8: {
    name: 'backtoschool',
    label: 'August',
    light: {
      accent: '25 80% 50%',
      accentForeground: '0 0% 100%',
      highlight: '210 60% 50%',
      subtle: '25 30% 95%',
    },
    dark: {
      accent: '25 70% 50%',
      accentForeground: '0 0% 100%',
      highlight: '210 50% 45%',
      subtle: '25 25% 15%',
    },
  },
  9: {
    name: 'fall',
    label: 'September',
    light: {
      accent: '30 70% 45%',
      accentForeground: '0 0% 100%',
      highlight: '15 60% 40%',
      subtle: '30 30% 95%',
    },
    dark: {
      accent: '30 60% 45%',
      accentForeground: '0 0% 100%',
      highlight: '15 50% 35%',
      subtle: '30 25% 15%',
    },
  },
  10: {
    name: 'halloween',
    label: 'October',
    light: {
      accent: '25 95% 55%',
      accentForeground: '0 0% 100%',
      highlight: '275 60% 50%',
      subtle: '25 40% 95%',
    },
    dark: {
      accent: '25 85% 50%',
      accentForeground: '0 0% 100%',
      highlight: '275 50% 40%',
      subtle: '25 30% 15%',
    },
  },
  11: {
    name: 'thanksgiving',
    label: 'November',
    light: {
      accent: '35 70% 40%',
      accentForeground: '0 0% 100%',
      highlight: '15 50% 35%',
      subtle: '35 30% 95%',
    },
    dark: {
      accent: '35 60% 42%',
      accentForeground: '0 0% 100%',
      highlight: '15 45% 32%',
      subtle: '35 25% 15%',
    },
  },
  12: {
    name: 'christmas',
    label: 'December',
    light: {
      accent: '350 70% 45%',
      accentForeground: '0 0% 100%',
      highlight: '150 60% 30%',
      subtle: '350 30% 95%',
    },
    dark: {
      accent: '350 65% 45%',
      accentForeground: '0 0% 100%',
      highlight: '150 50% 28%',
      subtle: '350 25% 15%',
    },
  },
};
