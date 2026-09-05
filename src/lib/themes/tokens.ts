/**
 * The tokens a theme is allowed to set.
 *
 * This list is the security boundary, not a convention. A theme is data that
 * can arrive from a community gallery, so the path from submitted text to a
 * CSS property name must not exist: property names come from here, never from
 * the payload.
 *
 * Deliberately excluded:
 *
 * - `--seasonal-*`. Owned by useSeasonalTheme, which writes them imperatively
 *   from a month-keyed palette. Two writers of the same four properties on the
 *   same element is a last-effect-wins bug; the sets stay disjoint.
 * - `--chart-1..5`. Defined in globals.css, mapped nowhere, consumed nowhere.
 */
export const THEME_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

/** A complete set of values for one mode. */
export type ThemeTokens = Record<ThemeToken, string>;

/**
 * Shape values, which are not colours and do not differ between light and dark.
 *
 * Colour alone makes themes read as tints of each other — the same app with a
 * filter over it. Corner rounding is the cheapest thing that changes what
 * something looks *like* rather than what colour it is: square corners and
 * pill buttons are recognisably different products.
 *
 * Capped, because these are the values that can make a layout look broken
 * rather than styled. A theme cannot express anything outside the range.
 */
export interface ThemeShape {
  /** Corner rounding, in rem. 0 is square; the cap stops cards becoming lozenges. */
  radius: number;
  /**
   * Multiplier on the padding inside cards and the gaps between them.
   *
   * The largest lever of the three. Density is most of what separates one
   * design language from another — a spacious layout and a compact one read as
   * different products even in identical colours.
   */
  density: number;
  /** Border thickness in px. 0 is borderless, which is a real style. */
  borderWidth: number;
}

/**
 * Every shape value is a capped number.
 *
 * The cap is what keeps a theme from expressing something broken. Past a point
 * these stop being style and start being a layout fault, and the person who
 * installed the theme cannot tell the difference.
 */
export const SHAPE_LIMITS = {
  radius: { min: 0, max: 1.5, default: 0.5 },
  // Below 0.75 text starts touching card edges; above 1.5 a wall display fits
  // very little on screen, which defeats the point of a dashboard.
  density: { min: 0.75, max: 1.5, default: 1 },
  borderWidth: { min: 0, max: 3, default: 1 },
} as const;

type ShapeKey = keyof typeof SHAPE_LIMITS;
const SHAPE_KEYS = Object.keys(SHAPE_LIMITS) as ShapeKey[];

export function isValidShape(value: unknown): value is ThemeShape {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return SHAPE_KEYS.every((key) => {
    const v = s[key];
    if (v === undefined) return true; // absent falls back to the default
    const { min, max } = SHAPE_LIMITS[key];
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  });
}

/** Clamp rather than reject, so an out-of-range value degrades to the nearest legal one. */
export function normalizeShape(value: unknown): ThemeShape {
  const s = (value ?? {}) as Record<string, unknown>;
  const out = {} as ThemeShape;
  for (const key of SHAPE_KEYS) {
    const { min, max, default: fallback } = SHAPE_LIMITS[key];
    const v = s[key];
    out[key] = typeof v === 'number' && Number.isFinite(v)
      ? Math.min(max, Math.max(min, v))
      : fallback;
  }
  return out;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  light: ThemeTokens;
  dark: ThemeTokens;
  /**
   * Optional, and partial. Any value left out takes the default, so a theme
   * only states what it actually wants to change.
   */
  shape?: Partial<ThemeShape>;
}

/**
 * Bare HSL triple, as Tailwind expects — `hsl(var(--x))` supplies the wrapper,
 * which is what makes opacity modifiers like `bg-primary/40` work across the
 * ~230 files that use them. Hex here would break every one of those.
 *
 * The narrowness is the point. No `var()`, no `calc()`, no alpha, no named
 * colours, no `url()`. It is not possible to express anything but a colour, so
 * "could a value inject CSS" stops being a question that needs arguing.
 */
const HSL_TRIPLE = /^(\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$/;

export function isValidTokenValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = HSL_TRIPLE.exec(value);
  if (!m) return false;
  const [h, s, l] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return h <= 360 && s <= 100 && l <= 100;
}

/** True when every token is present and every value is a valid triple. */
export function isValidTokenSet(value: unknown): value is ThemeTokens {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return THEME_TOKENS.every((t) => isValidTokenValue(obj[t]));
}

/**
 * A complete, installable theme from an untrusted source.
 *
 * Used when reading themes back out of storage. The API validates on the way
 * in, but this is the last point before the values become CSS, and a stored
 * row is not the same thing as a trusted one.
 */
export function isInstallableTheme(value: unknown): value is Theme {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 64 &&
    typeof t.name === 'string' && t.name.length > 0 && t.name.length <= 40 &&
    typeof t.description === 'string' && t.description.length <= 160 &&
    isValidTokenSet(t.light) &&
    isValidTokenSet(t.dark) &&
    (t.shape === undefined || isValidShape(t.shape))
  );
}
