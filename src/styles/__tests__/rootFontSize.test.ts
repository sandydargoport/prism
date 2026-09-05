/**
 * Structural guard: the root font-size ladder must cover pointerless displays.
 *
 * Root size stands in for viewing distance, which CSS cannot measure, so the
 * ladder keys on the `pointer` media feature. That feature has three values
 * and the ladder originally handled two: `coarse` (a touchscreen) climbed to
 * 22px, `fine` (a mouse) dropped to 14px, and `none` was not mentioned at all.
 *
 * `none` means no input device, which in practice is a kiosk — a Pi or an HDMI
 * stick driving a screen nobody touches. That is the one display class
 * guaranteed to be read from across a room, and it silently fell through to
 * the 16px base. Text ends up near the limit of being identifiable at that
 * distance, let alone readable.
 *
 * No behavioural test caught it because nothing was broken in isolation: each
 * media query was individually correct and the set was incomplete. This reads
 * the stylesheet instead, so dropping the `none` branch fails here rather than
 * on someone's kitchen wall.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import postcss from 'postcss';

const CSS_PATH = join(process.cwd(), 'src', 'styles', 'globals.css');

/** Every `html { font-size }` declared inside a media query, with its condition. */
function ladderSteps(css: string): { params: string; size: string }[] {
  const steps: { params: string; size: string }[] = [];
  postcss.parse(css).walkAtRules('media', (at) => {
    at.walkRules((rule) => {
      if (rule.selector.trim() !== 'html') return;
      rule.walkDecls('font-size', (decl) => {
        steps.push({ params: at.params.replace(/\s+/g, ' ').trim(), size: decl.value });
      });
    });
  });
  return steps;
}

/** The unconditional `html { font-size }`, outside any media query. */
function baseSize(css: string): string | undefined {
  let found: string | undefined;
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector.trim() !== 'html') return;
    // `@layer base` is an at-rule too, so only a media condition disqualifies.
    // postcss types `parent` as a union that includes Document, so walk loosely.
    let node = rule.parent as { type?: string; name?: string; parent?: unknown } | undefined;
    while (node) {
      if (node.type === 'atrule' && node.name === 'media') return;
      node = node.parent as typeof node;
    }
    rule.walkDecls('font-size', (decl) => {
      found = decl.value;
    });
  });
  return found;
}

describe('root font-size ladder', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const steps = ladderSteps(css);

  it('declares an unconditional base size', () => {
    expect(baseSize(css)).toBe('16px');
  });

  it('scales up for larger viewports', () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  // The actual regression. A pointerless kiosk is further from the screen than
  // a desk, never closer, so any step that enlarges text for a touchscreen has
  // to enlarge it for `none` as well.
  it.each([768, 1024, 1400])(
    'covers pointer:none wherever it covers pointer:coarse (%ipx step)',
    (width) => {
      const step = steps.find((s) => s.params.includes(`min-width: ${width}px`));
      expect(step).toBeDefined();
      expect(step!.params).toContain('pointer: coarse');
      expect(step!.params).toContain('pointer: none');
    },
  );

  it('never leaves a coarse step without its none counterpart', () => {
    const orphans = steps.filter(
      (s) => s.params.includes('pointer: coarse') && !s.params.includes('pointer: none'),
    );
    expect(orphans).toEqual([]);
  });

  // A mouse means someone is at a desk, close up. That stays tight, and is the
  // one branch this change deliberately left alone.
  it('keeps the fine-pointer branch tight', () => {
    const fine = steps.filter(
      (s) => s.params.includes('pointer: fine') && !s.params.includes('min-width'),
    );
    expect(fine).toHaveLength(1);
    expect(fine[0]!.size).toBe('14px');
  });
});
