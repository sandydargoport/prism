/**
 * "Hide widget outlines" must hide the perimeter of a screensaver widget and
 * nothing inside it.
 *
 * Two ways this has already gone wrong, both silent:
 *
 *  - `[&_.bg-card]` matched nothing. The card's class is `bg-card/85`, and in
 *    CSS that is a different class name entirely. A selector that matches
 *    nothing produces no error and no effect — the setting simply did nothing,
 *    and it took a DOM measurement to notice.
 *  - `[&_*]` matched everything, so it wiped the rules between table rows while
 *    leaving the outline it was supposed to remove: the exact opposite of the
 *    label, which is how it was reported.
 *
 * So this pins the shape of the rule rather than its effect: it must be scoped
 * to something that is both a card surface and bordered, and it must never be a
 * universal selector.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');
const screensaver = readFileSync(
  join(process.cwd(), 'src/components/screensaver/Screensaver.tsx'),
  'utf8',
);

describe('hide widget outlines', () => {
  it('has a rule for the perimeter', () => {
    expect(css).toContain('.prism-no-outline');
  });

  it('scopes it to the bordered card surface, not to everything', () => {
    const rule = css.slice(css.indexOf('.prism-no-outline'));
    const selector = rule.slice(0, rule.indexOf('{'));
    // matches the card by substring, because the class is `bg-card/85`
    expect(selector).toContain('[class*="bg-card"]');
    // and only where there is actually a perimeter to remove
    expect(selector).toContain('.border-border');
    expect(selector).not.toContain('*)');
  });

  it('clears the border rather than painting over it', () => {
    const body = css.slice(css.indexOf('.prism-no-outline'));
    expect(body.slice(0, body.indexOf('}'))).toContain('border-color: transparent');
  });

  it('never reaches for a universal selector in the screensaver wrapper', () => {
    // `[&_*]:!border-transparent` is the shape that broke the inner rules
    expect(screensaver).not.toMatch(/\[&_\*\]:!border/);
  });
});
