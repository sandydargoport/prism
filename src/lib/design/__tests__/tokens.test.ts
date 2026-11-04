/**
 * The design tokens are rules, so they are checked rather than trusted:
 * readable contrast, a real hierarchy, nothing under the text floor, and the
 * CSS and docs/DESIGN.md saying the same numbers as tokens.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  CARD, EVENT, PAPER, PAPER_CONTRAST_MIN, PHOTO_DIM, REFERENCE_ROOT_PX, SPACE_PX,
  TARGET_MIN_PX, TEXT_FLOOR_PX, TYPE_SCALE, TYPE_STEP_MIN, type TypeRole,
} from '../tokens';
import { checkThemeContrast, EDGE_MIN } from '@/lib/themes/contrast';
import { isValidTokenSet } from '@/lib/themes/tokens';
import { contrastRatioHex, hslToHex } from '@/lib/utils/color';
import { MEMBER_COLOR_OPTIONS } from '@/lib/constants/memberColors';
import { cn } from '@/lib/utils/cn';

const ROOT = path.resolve(__dirname, '../../../..');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/globals.css'), 'utf8');
const designDoc = fs.readFileSync(path.join(ROOT, 'docs/DESIGN.md'), 'utf8');

const ROLES = Object.keys(TYPE_SCALE) as TypeRole[];
const MODES = ['light', 'dark'] as const;

/** sRGB mix, as `color-mix(in srgb, a share, b)` draws it. */
function mix(a: string, b: string, share: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) * share + ch(b, i) * (1 - share)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function cssValue(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`${name} is missing from globals.css`);
  return m[1]!.trim();
}

const remToPx = (value: string) => {
  const m = /([\d.]+)rem/.exec(value);
  if (!m) throw new Error(`no rem in ${value}`);
  return Number(m[1]) * REFERENCE_ROOT_PX;
};

describe('type scale', () => {
  it('starts at the text floor and never goes under it', () => {
    expect(TYPE_SCALE.caption.px).toBe(TEXT_FLOOR_PX);
    for (const role of ROLES) expect(TYPE_SCALE[role].px).toBeGreaterThanOrEqual(TEXT_FLOOR_PX);
  });

  it('steps up by at least 1.25x, so there is one clear order to read in', () => {
    for (let i = 1; i < ROLES.length; i++) {
      const ratio = TYPE_SCALE[ROLES[i]!].px / TYPE_SCALE[ROLES[i - 1]!].px;
      expect(ratio).toBeGreaterThanOrEqual(TYPE_STEP_MIN);
    }
  });

  it.each(ROLES)('globals.css draws text-%s at the token size, floored', (role) => {
    const value = cssValue(`--text-${role}`);
    expect(value).toContain('var(--text-floor) * var(--zoom-inv, 1)');
    expect(remToPx(value)).toBeCloseTo(TYPE_SCALE[role].px, 5);
    expect(Number(cssValue(`--text-${role}--line-height`))).toBe(TYPE_SCALE[role].lineHeight);
  });

  it('no component draws text at a fixed pixel size, which would skip the floor (#893, #894)', () => {
    // text-[10px] compiles to a plain font-size and never meets --text-floor.
    // The floored sizes are text-2xs (11px), text-3xs (10px), text-4xs (8-9px).
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (/\.(tsx?|css)$/.test(entry.name)) {
          const rel = path.relative(ROOT, full);
          fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
            if (/text-\[\d+(\.\d+)?px\]/.test(line)) offenders.push(`${rel}:${i + 1}`);
          });
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });

  it('cn keeps a role size next to a text colour', () => {
    for (const role of ROLES) {
      expect(cn(`text-${role}`, 'text-muted-foreground')).toBe(`text-${role} text-muted-foreground`);
    }
  });
});

describe('shape tokens', () => {
  it('spacing sits on the 4px grid', () => {
    for (const s of SPACE_PX) expect(s % 4).toBe(0);
    expect(SPACE_PX).toContain(CARD.paddingPx);
    expect(SPACE_PX).toContain(CARD.gapPx);
  });

  it('globals.css matches tokens.ts', () => {
    expect(cssValue('--ds-target-min')).toBe(`${TARGET_MIN_PX}px`);
    expect(remToPx(cssValue('--ds-card-radius'))).toBeCloseTo(CARD.radiusPx, 5);
    expect(remToPx(cssValue('--ds-card-pad'))).toBeCloseTo(CARD.paddingPx, 5);
    expect(remToPx(cssValue('--ds-card-gap'))).toBeCloseTo(CARD.gapPx, 5);
    expect(cssValue('--ds-glass-blur')).toBe(`${CARD.glassBlurPx}px`);
    expect(cssValue('--ds-event-bar')).toBe(`${EVENT.barPx}px`);
    // First match is :root (light), the .dark block overrides it.
    const tints = [...css.matchAll(/--ds-event-tint:\s*([\d.]+)%;/g)].map((m) => Number(m[1]) / 100);
    expect(tints).toEqual([EVENT.tint.light, EVENT.tint.dark]);
    // Glass the same way; the Performance Mode block comes before both.
    const glass = [...css.matchAll(/--ds-glass-alpha:\s*([\d.]+);/g)].map((m) => Number(m[1])).slice(1);
    expect(glass).toEqual([CARD.glassAlpha.light, CARD.glassAlpha.dark]);
  });
});

describe('glass under Performance Mode', () => {
  it('drops the blur and thickens the glass, never thinner than the normal glass', () => {
    const block = /html\.performance-mode \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/--ds-glass-filter:\s*none;/);
    const alpha = Number(/--ds-glass-alpha:\s*([\d.]+);/.exec(block)?.[1]);
    expect(alpha).toBeGreaterThan(Math.max(CARD.glassAlpha.light, CARD.glassAlpha.dark));
  });
});

describe('status pills (#891)', () => {
  // Status words sit on a solid fill, so their contrast is the fill against its
  // own foreground, never the photo behind a glass card.
  it.each(MODES)('the Paper red pill reads at 4.5:1 in %s', (mode) => {
    const ratio = contrastRatioHex(hslToHex(PAPER[mode]['destructive-foreground']), hslToHex(PAPER[mode].destructive));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('the amber pill reads at 4.5:1 in light and dark (globals.css, Paper sets none)', () => {
    const block = (sel: RegExp) => sel.exec(css)?.[1] ?? '';
    const light = block(/:root\s*\{([^}]*--warning:[^}]*)\}/);
    const dark = block(/\.dark\s*\{([^}]*--warning:[^}]*)\}/);
    for (const b of [light, dark]) {
      const v = (n: string) => new RegExp(`${n}:\\s*([^;]+);`).exec(b)![1]!.trim();
      expect(contrastRatioHex(hslToHex(v('--warning-foreground')), hslToHex(v('--warning')))).toBeGreaterThanOrEqual(4.5);
    }
    expect(light).not.toBe(dark);
  });
});

describe('Paper palette', () => {
  it('is a complete, valid token set in both modes', () => {
    expect(isValidTokenSet(PAPER.light)).toBe(true);
    expect(isValidTokenSet(PAPER.dark)).toBe(true);
  });

  it('every text pair reaches 4.5:1 (no warnings, not just no errors)', () => {
    const { errors, warnings } = checkThemeContrast(PAPER);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it.each(MODES)('has one accent in %s: only primary, ring and destructive are saturated', (mode) => {
    const t = PAPER[mode];
    const hue = (v: string) => v.split(' ')[0];
    const sat = (v: string) => Number(v.split(' ')[1]!.replace('%', ''));
    expect(hue(t.ring)).toBe(hue(t.primary));
    for (const [key, value] of Object.entries(t)) {
      if (['primary', 'ring', 'destructive'].includes(key)) continue;
      expect([key, sat(value) <= 40]).toEqual([key, true]);
    }
  });

  // A photo never reaches the glass at full strength: it is drawn under a
  // black layer (PHOTO_DIM). So the worst cases are a pure black and a pure
  // white photo as they look under that layer, for every kind of photo.
  it.each(MODES)('glass cards stay readable in %s over any photo, as it is drawn', (mode) => {
    const card = hslToHex(PAPER[mode].card);
    const text = hslToHex(PAPER[mode]['card-foreground']);
    for (const [kind, dim] of Object.entries(PHOTO_DIM)) {
      for (const photo of ['#000000', '#ffffff']) {
        const drawn = mix('#000000', photo, dim[mode]);
        const ratio = contrastRatioHex(text, mix(card, drawn, CARD.glassAlpha[mode]));
        expect([kind, photo, ratio >= PAPER_CONTRAST_MIN]).toEqual([kind, photo, true]);
      }
    }
  });

  it('the wallpaper draws the black layer the glass check assumes', () => {
    const wallpaper = fs.readFileSync(path.join(ROOT, 'src/components/layout/WallpaperBackground.tsx'), 'utf8');
    for (const dim of Object.values(PHOTO_DIM)) {
      expect(wallpaper).toContain(`bg-black/${dim.light * 100} dark:bg-black/${dim.dark * 100}`);
    }
  });

  it.each(MODES)('event tints keep normal text readable for every member colour in %s', (mode) => {
    const card = hslToHex(PAPER[mode].card);
    const text = hslToHex(PAPER[mode]['card-foreground']);
    for (const { value, name } of MEMBER_COLOR_OPTIONS) {
      const tint = mix(value, card, EVENT.tint[mode]);
      expect([name, contrastRatioHex(text, tint) >= PAPER_CONTRAST_MIN]).toEqual([name, true]);
      // The bar only has to be seen against the card, like a border.
      expect([name, contrastRatioHex(value, card) >= EDGE_MIN]).toEqual([name, true]);
    }
  });
});

describe('docs/DESIGN.md', () => {
  it.each(ROLES)('lists text-%s at its size', (role) => {
    expect(designDoc).toMatch(new RegExp(`\\| \`text-${role}\` \\| ${TYPE_SCALE[role].px}px \\|`));
  });

  it('states the target size and the card numbers', () => {
    expect(designDoc).toContain(`${TARGET_MIN_PX}px`);
    expect(designDoc).toContain(`${CARD.radiusPx}px`);
    expect(designDoc).toContain(`${Math.round(CARD.glassAlpha.light * 100)}% in light`);
    expect(designDoc).toContain(`${Math.round(CARD.glassAlpha.dark * 100)}% in dark`);
  });
});
