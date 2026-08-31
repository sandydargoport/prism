/**
 * Checking that a theme can actually be read.
 *
 * Prism is read from across a room, often by someone who is not wearing their
 * glasses and is holding something in both hands. A theme that looks striking
 * on a laptop and turns the calendar into low-contrast grey-on-grey is worse
 * than no theme at all, and the person who installed it usually cannot tell
 * whether it is the theme or the screen.
 *
 * So legibility is checked, not trusted. This runs over the built-in themes in
 * their tests, and is the same function a gallery submission will be measured
 * against.
 */
import { contrastRatioHex, hslToHex } from '@/lib/utils/color';
import type { ThemeToken, ThemeTokens } from './tokens';

/** Below this, text is not readable and the theme is rejected. */
export const CONTRAST_ERROR = 3;
/** Below this it is legible but tiring; surfaced as a warning, not a block. */
export const CONTRAST_WARN = 4.5;
/** Borders only need to be visible, not readable. */
export const EDGE_MIN = 1.4;

/** Foreground/background pairs that carry text. */
const TEXT_PAIRS: Array<[ThemeToken, ThemeToken]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'muted'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
];

/** Pairs that only need to be distinguishable, so an edge is visible. */
const EDGE_PAIRS: Array<[ThemeToken, ThemeToken]> = [
  ['border', 'background'],
  ['border', 'card'],
];

export interface ContrastIssue {
  pair: string;
  ratio: number;
  level: 'error' | 'warning';
}

export function checkContrast(tokens: ThemeTokens): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const hex = (t: ThemeToken) => hslToHex(tokens[t]);

  for (const [fg, bg] of TEXT_PAIRS) {
    const ratio = contrastRatioHex(hex(fg), hex(bg));
    if (ratio < CONTRAST_ERROR) issues.push({ pair: `${fg} on ${bg}`, ratio, level: 'error' });
    else if (ratio < CONTRAST_WARN) issues.push({ pair: `${fg} on ${bg}`, ratio, level: 'warning' });
  }

  for (const [a, b] of EDGE_PAIRS) {
    const ratio = contrastRatioHex(hex(a), hex(b));
    // An edge that fails is a warning, never an error: a borderless look is a
    // deliberate style, where unreadable text never is.
    if (ratio < EDGE_MIN) issues.push({ pair: `${a} against ${b}`, ratio, level: 'warning' });
  }

  return issues;
}

/** Both modes at once, since a theme is only usable if both are. */
export function checkThemeContrast(theme: { light: ThemeTokens; dark: ThemeTokens }): {
  errors: ContrastIssue[];
  warnings: ContrastIssue[];
} {
  const all = [
    ...checkContrast(theme.light).map((i) => ({ ...i, pair: `light: ${i.pair}` })),
    ...checkContrast(theme.dark).map((i) => ({ ...i, pair: `dark: ${i.pair}` })),
  ];
  return {
    errors: all.filter((i) => i.level === 'error'),
    warnings: all.filter((i) => i.level === 'warning'),
  };
}
