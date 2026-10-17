/**
 * Family member colours.
 *
 * A member's colour is stored as a plain `#RRGGBB` string (users.color,
 * varchar(7)), so the presets below are only suggestions: any value that
 * passes `isHexColor` is a valid colour, and a member whose colour is not in
 * this list keeps rendering it exactly as stored.
 *
 * The first eight entries are the original palette and must stay as they are,
 * in this order: they are what existing members already have, and the setup
 * wizard hands them out in sequence. The additions after them are darker
 * shades picked to stay apart from every other entry (checked in
 * memberColors.test.ts) and to keep white text readable on them, since
 * calendar events and avatars draw white text on a member's colour.
 */

import { contrastRatioHex } from '@/lib/utils/color';

export type MemberColorOption = {
  value: string;
  /** Spoken name for the swatch, used as its accessible label. */
  name: string;
};

export const MEMBER_COLOR_OPTIONS: readonly MemberColorOption[] = [
  // Original palette (do not reorder or change)
  { value: '#3B82F6', name: 'Blue' },
  { value: '#EC4899', name: 'Pink' },
  { value: '#10B981', name: 'Emerald' },
  { value: '#F59E0B', name: 'Amber' },
  { value: '#8B5CF6', name: 'Violet' },
  { value: '#EF4444', name: 'Red' },
  { value: '#06B6D4', name: 'Cyan' },
  { value: '#84CC16', name: 'Lime' },
  // Added in #640
  { value: '#9A3412', name: 'Rust' },
  { value: '#15803D', name: 'Forest green' },
  { value: '#0D9488', name: 'Teal' },
  { value: '#1D4ED8', name: 'Royal blue' },
  { value: '#A21CAF', name: 'Magenta' },
  { value: '#BE185D', name: 'Raspberry' },
  { value: '#6B7280', name: 'Gray' },
  { value: '#A16207', name: 'Gold' },
  { value: '#6D28D9', name: 'Purple' },
  { value: '#0369A1', name: 'Ocean' },
];

export const MEMBER_COLORS: readonly string[] = MEMBER_COLOR_OPTIONS.map((o) => o.value);

export const DEFAULT_MEMBER_COLOR = '#3B82F6';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** True for a `#RRGGBB` string and nothing else. The server uses the same rule. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Case-insensitive colour comparison (a native colour input reports lowercase). */
export function sameColor(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toUpperCase() === b.toUpperCase();
}

/** The preset matching `color`, if there is one. */
export function findMemberColorOption(color: string): MemberColorOption | undefined {
  return MEMBER_COLOR_OPTIONS.find((o) => sameColor(o.value, color));
}

/**
 * The first preset nobody is using yet, falling back to cycling through the
 * palette once every preset is taken.
 */
export function nextFreeMemberColor(taken: readonly string[]): string {
  const free = MEMBER_COLORS.find((c) => !taken.some((t) => sameColor(t, c)));
  return free ?? MEMBER_COLORS[taken.length % MEMBER_COLORS.length] ?? DEFAULT_MEMBER_COLOR;
}

/**
 * Below this contrast against white, white initials and event titles drawn on
 * the colour get hard to read. Every preset clears it (the lowest, Lime, is
 * about 1.98:1), so only a custom colour can fall under it.
 */
export const MIN_WHITE_TEXT_CONTRAST = 1.9;

/** Below this contrast against the dark theme background, a colour dot fades into it. */
export const MIN_DARK_BACKGROUND_CONTRAST = 1.6;
const DARK_BACKGROUND = '#0F172A';

export function isTooLightForWhiteText(color: string): boolean {
  return isHexColor(color) && contrastRatioHex(color, '#FFFFFF') < MIN_WHITE_TEXT_CONTRAST;
}

export function isTooDarkForDarkTheme(color: string): boolean {
  return isHexColor(color) && contrastRatioHex(color, DARK_BACKGROUND) < MIN_DARK_BACKGROUND_CONTRAST;
}
