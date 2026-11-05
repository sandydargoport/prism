/**
 * Prism design tokens. docs/DESIGN.md explains each one; this file is the
 * value, and the CSS in globals.css copies it (a test checks they agree).
 *
 * Sizes are given in px as they render on the reference screen: a 1080p wall
 * display, where the root font size is 20px. CSS writes them in rem, so a
 * desk (14px root) and a phone (16px root) scale them down, and the text
 * floor stops the small ones going under 14px on a wall or 12px close up.
 *
 * The Paper palette and the setup wizard's Look step use these; the other
 * themes adopt them one surface at a time.
 */
import type { ThemeTokens } from '@/lib/themes/tokens';

/** Root font size on the reference screen (1080p, touch or kiosk). */
export const REFERENCE_ROOT_PX = 20;

/** Smallest text on a wall, matching --text-floor in globals.css (#798). */
export const TEXT_FLOOR_PX = 14;

/**
 * Five steps and no more. Each is at least 1.25x the one below, so the eye
 * finds the clock first, then the next thing, then the rows; equal-weight
 * boxes were the main reason the wall read as busy.
 */
export const TYPE_SCALE = {
  /** Times, counts, "+3 more", widget names. The floor itself. */
  caption: { px: 14, weight: 500, lineHeight: 1.35 },
  /** List rows: a chore, a shopping item, an agenda line. */
  body: { px: 20, weight: 400, lineHeight: 1.4 },
  /** The thing a row is about: an event title in Now/Next, a person's name. */
  title: { px: 28, weight: 600, lineHeight: 1.25 },
  /** The date line and the one headline per screen. */
  display: { px: 48, weight: 600, lineHeight: 1.1 },
  /** The clock. Medium weight, tight spacing, tabular figures (#800). */
  clock: { px: 100, weight: 500, lineHeight: 1 },
} as const;

export type TypeRole = keyof typeof TYPE_SCALE;

/**
 * Prose: sentences on the wall ("Tomorrow Alex has the dentist at 9"). Not a
 * sixth step: it reads at the title's size in regular weight with looser
 * lines, so a sentence sits level with the row titles without shouting.
 */
export const PROSE = { size: 'title', weight: 400, lineHeight: 1.35 } as const satisfies {
  size: TypeRole; weight: number; lineHeight: number;
};

/**
 * Faces by role (#800). The display face (Fraunces) draws the clock, the
 * temperature and page and sheet titles; everything else is the theme's text
 * face (Inter by default). A theme that names its own numeral face keeps it.
 */
export const FACE = {
  display: { family: 'Fraunces', roles: ['clock', 'display'] as TypeRole[] },
  text: { family: 'Inter' },
} as const;

/** Minimum step between adjacent type roles. */
export const TYPE_STEP_MIN = 1.25;

/** Every gap and padding is one of these (a 4px grid). */
export const SPACE_PX = [4, 8, 12, 16, 24, 32, 48] as const;

/** Anything a finger presses is at least this big in both directions. */
export const TARGET_MIN_PX = 44;

/** The one card material. Same shape everywhere; only the fill changes. */
export const CARD = {
  radiusPx: 16,
  paddingPx: 24,
  gapPx: 16,
  borderPx: 1,
  /**
   * Over a photo the card is its own colour at this opacity, plus blur.
   * Dark glass is thinner: light text on it stays readable over a bright
   * photo, while light glass needs more card to keep its dark grey text.
   */
  glassAlpha: { light: 0.65, dark: 0.4 },
  glassBlurPx: 24,
} as const;

/**
 * The black layer laid over a wallpaper photo, as a share, so no photo reaches
 * the glass at full brightness. Glass contrast is checked against the darkest
 * and brightest a photo can be once it is under this layer. The bundled scenery
 * is dimmed lightly so it shows; photos the family added keep the old,
 * heavier layer.
 */
export const PHOTO_DIM = {
  scenery: { light: 0.1, dark: 0.4 },
  photos: { light: 0.6, dark: 0.7 },
} as const;

/**
 * Events: a pale tint of the person's colour with a solid bar on the leading
 * edge, and the text in the normal text colour (#801). Never white text on a
 * saturated block.
 */
export const EVENT = {
  barPx: 4,
  /** Share of the person's colour mixed into the card colour. */
  tint: { light: 0.16, dark: 0.26 },
} as const;

/** Motion, in ms. Performance Reduced and prefers-reduced-motion skip all of it. */
export const MOTION_MS = { fast: 150, base: 250, slow: 600 } as const;

/**
 * Warm paper neutrals with one accent. The same 19 tokens a theme carries, so
 * it can be registered as a built-in theme (#808) without reshaping.
 *
 * One accent means `primary` and `ring` share a hue and nothing else is
 * saturated: colour on the wall comes from people's colours, not from chrome.
 */
export const PAPER: { light: ThemeTokens; dark: ThemeTokens } = {
  light: {
    background: '40 30% 95%',
    foreground: '30 12% 14%',
    card: '40 40% 99%',
    'card-foreground': '30 12% 14%',
    popover: '40 40% 99%',
    'popover-foreground': '30 12% 14%',
    primary: '214 62% 40%',
    'primary-foreground': '40 40% 99%',
    secondary: '38 22% 90%',
    'secondary-foreground': '30 12% 14%',
    muted: '38 22% 90%',
    'muted-foreground': '30 8% 36%',
    accent: '38 22% 90%',
    'accent-foreground': '30 12% 14%',
    destructive: '4 68% 44%',
    'destructive-foreground': '40 40% 99%',
    border: '36 16% 76%',
    input: '36 16% 76%',
    ring: '214 62% 40%',
  },
  dark: {
    background: '30 8% 8%',
    foreground: '38 22% 92%',
    card: '30 7% 12%',
    'card-foreground': '38 22% 92%',
    popover: '30 7% 12%',
    'popover-foreground': '38 22% 92%',
    primary: '212 80% 72%',
    'primary-foreground': '30 8% 8%',
    secondary: '30 6% 18%',
    'secondary-foreground': '38 22% 92%',
    muted: '30 6% 18%',
    'muted-foreground': '34 10% 68%',
    accent: '30 6% 18%',
    'accent-foreground': '38 22% 92%',
    destructive: '4 62% 40%',
    'destructive-foreground': '38 22% 96%',
    border: '30 6% 24%',
    input: '30 6% 24%',
    ring: '212 80% 72%',
  },
};

/** Contrast every text pair in PAPER must reach (WCAG AA body text). */
export const PAPER_CONTRAST_MIN = 4.5;
