/**
 * Controls that are hidden until hover must stay visible on a touchscreen.
 *
 * Tailwind v4 wraps every hover variant, group-hover included, in
 * `@media (hover: hover)`, so on a device that cannot hover an
 * `opacity-0 group-hover:opacity-100` control is never shown. Each such control
 * needs a `pointer-coarse:` opacity of its own. `max-md:` alone is not enough:
 * a wall-mounted touchscreen is wider than the md breakpoint.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'src');

/** Hover-revealed on purpose with no touch fallback, and why. */
const EXEMPT: Record<string, string> = {
  // A decorative star next to a place name, not a control.
  'src/components/widgets/TravelWidget.tsx': 'decoration',
};

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : tsxFiles(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

function hoverRevealedClassNames(source: string): string[] {
  const classNames = source.match(/(["'`])[^"'`]*\1/g) ?? [];
  return classNames.filter(
    (c) => /(^|\s|["'`])opacity-0(\s|["'`])/.test(c) && c.includes('group-hover:opacity-100'),
  );
}

const cases = tsxFiles(ROOT)
  .map((file) => path.relative(process.cwd(), file))
  .filter((file) => !(file in EXEMPT))
  .flatMap((file) =>
    hoverRevealedClassNames(readFileSync(file, 'utf8')).map((className) => [file, className] as const),
  );

describe('hover-revealed controls', () => {
  it('finds the controls it is meant to check', () => {
    // The meal plan's actions were the first ones found without a fallback.
    expect(cases.some(([file]) => file === 'src/app/meals/MealsView.tsx')).toBe(true);
  });

  it.each(cases)('%s: %s is visible on a coarse pointer', (_file, className) => {
    expect(className).toMatch(/pointer-coarse:opacity-(?!0\b)\d+/);
  });

  it('exempts only files that still have such a control', () => {
    for (const file of Object.keys(EXEMPT)) {
      expect(hoverRevealedClassNames(readFileSync(file, 'utf8')).length).toBeGreaterThan(0);
    }
  });
});
