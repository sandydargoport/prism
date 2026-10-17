/**
 * The family member palette (#640): enough presets for a large family, each one
 * clearly apart from the others, and the original eight left exactly as they
 * were so existing members keep their colour.
 */

import {
  MEMBER_COLORS,
  MEMBER_COLOR_OPTIONS,
  isHexColor,
  isTooDarkForDarkTheme,
  isTooLightForWhiteText,
  nextFreeMemberColor,
  sameColor,
} from '../memberColors';
import { contrastRatioHex } from '@/lib/utils/color';

// OKLab, the perceptual space the distance check below is measured in.
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function distance(a: string, b: string): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const ORIGINAL = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

describe('member colour palette', () => {
  it('keeps the original eight first, unchanged and in order', () => {
    expect(MEMBER_COLORS.slice(0, ORIGINAL.length)).toEqual(ORIGINAL);
  });

  it('has at least 16 presets', () => {
    expect(MEMBER_COLORS.length).toBeGreaterThanOrEqual(16);
  });

  it('holds only valid, unique hex values with names', () => {
    for (const option of MEMBER_COLOR_OPTIONS) {
      expect(isHexColor(option.value)).toBe(true);
      expect(option.name.trim()).not.toBe('');
    }
    expect(new Set(MEMBER_COLORS.map((c) => c.toUpperCase())).size).toBe(MEMBER_COLORS.length);
    expect(new Set(MEMBER_COLOR_OPTIONS.map((o) => o.name)).size).toBe(MEMBER_COLOR_OPTIONS.length);
  });

  it('keeps every pair of presets clearly apart', () => {
    // 0.1 in OKLab is a difference you see at a glance on a small dot. The
    // closest pair in the original eight (pink and red) sits at about 0.114.
    const close: string[] = [];
    for (let i = 0; i < MEMBER_COLORS.length; i++) {
      for (let j = i + 1; j < MEMBER_COLORS.length; j++) {
        const d = distance(MEMBER_COLORS[i]!, MEMBER_COLORS[j]!);
        if (d < 0.1) close.push(`${MEMBER_COLORS[i]} / ${MEMBER_COLORS[j]}: ${d.toFixed(3)}`);
      }
    }
    expect(close).toEqual([]);
  });

  it('keeps white text readable on the added presets', () => {
    for (const c of MEMBER_COLORS.slice(ORIGINAL.length)) {
      expect(contrastRatioHex(c, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every preset visible on the light and dark theme backgrounds', () => {
    for (const c of MEMBER_COLORS) {
      expect(contrastRatioHex(c, '#FFFFFF')).toBeGreaterThanOrEqual(1.9);
      expect(contrastRatioHex(c, '#0F172A')).toBeGreaterThanOrEqual(2.4);
      expect(isTooLightForWhiteText(c)).toBe(false);
      expect(isTooDarkForDarkTheme(c)).toBe(false);
    }
  });
});

describe('isHexColor', () => {
  it.each(['#3B82F6', '#abcdef', '#000000', '#FfFfFf'])('accepts %s', (v) => {
    expect(isHexColor(v)).toBe(true);
  });

  it.each([
    '', '#fff', '3B82F6', '#3B82F6 ', ' #3B82F6', '#3B82F60', '#GGGGGG',
    'red', 'rgb(0,0,0)', '#3B82F6;background:url(x)', '#3B82F6\n',
    null, undefined, 123, {}, ['#3B82F6'],
  ])('refuses %p', (v) => {
    expect(isHexColor(v)).toBe(false);
  });
});

describe('nextFreeMemberColor', () => {
  it('skips colours already taken, ignoring case', () => {
    expect(nextFreeMemberColor([])).toBe('#3B82F6');
    expect(nextFreeMemberColor(['#3b82f6', '#EC4899'])).toBe('#10B981');
  });

  it('ignores custom colours that are not presets', () => {
    expect(nextFreeMemberColor(['#123456'])).toBe('#3B82F6');
  });

  it('cycles once every preset is taken', () => {
    const all = [...MEMBER_COLORS];
    expect(MEMBER_COLORS).toContain(nextFreeMemberColor(all));
  });
});

describe('sameColor', () => {
  it('compares case-insensitively and treats empty as no match', () => {
    expect(sameColor('#ABCDEF', '#abcdef')).toBe(true);
    expect(sameColor('#ABCDEF', '#ABCDEE')).toBe(false);
    expect(sameColor('', '')).toBe(false);
    expect(sameColor(null, '#ABCDEF')).toBe(false);
  });
});

describe('custom colour warnings', () => {
  it('flags colours too light for white text or too dark for the dark theme', () => {
    expect(isTooLightForWhiteText('#FFFFFF')).toBe(true);
    expect(isTooLightForWhiteText('#FDE68A')).toBe(true);
    expect(isTooDarkForDarkTheme('#000000')).toBe(true);
    expect(isTooDarkForDarkTheme('#111827')).toBe(true);
    expect(isTooLightForWhiteText('#3B82F6')).toBe(false);
  });
});
