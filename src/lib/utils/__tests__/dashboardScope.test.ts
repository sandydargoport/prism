/**
 * Navigation has to stay inside the dashboard you are looking at.
 *
 * A dashboard carries its own font scale and its subpages honour it, but only
 * while the URL says which dashboard you are in. The navigation linked to
 * `/chores` rather than `/d/kitchen/chores`, so one tap left the dashboard and
 * the display dropped back to 100% — reported as scaling that "doesn't stay
 * when navigating between pages".
 */
import { scopedHref, isNavActive, dashboardSlug, SCOPED_ROUTES } from '../dashboardScope';

describe('dashboardSlug', () => {
  it.each([
    ['/d/kitchen', 'kitchen'],
    ['/d/kitchen/chores', 'kitchen'],
    ['/d/scale150/calendar', 'scale150'],
    ['/chores', null],
    ['/', null],
    ['', null],
  ])('%s -> %s', (path, slug) => {
    expect(dashboardSlug(path)).toBe(slug);
  });
});

describe('scopedHref', () => {
  it('keeps a destination inside the dashboard you are in', () => {
    expect(scopedHref('/chores', '/d/kitchen')).toBe('/d/kitchen/chores');
    expect(scopedHref('/chores', '/d/kitchen/calendar')).toBe('/d/kitchen/chores');
  });

  it('sends the home link back to the dashboard, not to the default one', () => {
    expect(scopedHref('/', '/d/kitchen/chores')).toBe('/d/kitchen');
  });

  it('leaves things alone outside a dashboard', () => {
    expect(scopedHref('/chores', '/calendar')).toBe('/chores');
    expect(scopedHref('/', '/calendar')).toBe('/');
  });

  it('does not invent a scoped route that does not exist', () => {
    // Settings deliberately has no scoped twin: it is where the scale is
    // changed, and a settings page at 150% is the one place being too large
    // actively gets in the way.
    expect(scopedHref('/settings', '/d/kitchen')).toBe('/settings');
    expect(SCOPED_ROUTES).not.toContain('/settings');
  });

  it('covers every destination the navigation offers except settings', () => {
    for (const href of ['/calendar', '/tasks', '/chores', '/goals', '/shopping',
      '/meals', '/recipes', '/messages', '/photos', '/wishes', '/babysitter',
      '/travel', '/weekend']) {
      expect(scopedHref(href, '/d/kitchen')).toBe(`/d/kitchen${href}`);
    }
  });
});

describe('isNavActive', () => {
  it('highlights the open page inside a dashboard', () => {
    expect(isNavActive('/chores', '/d/kitchen/chores')).toBe(true);
    expect(isNavActive('/calendar', '/d/kitchen/chores')).toBe(false);
  });

  it('highlights home only on the dashboard itself', () => {
    expect(isNavActive('/', '/d/kitchen')).toBe(true);
    expect(isNavActive('/', '/d/kitchen/chores')).toBe(false);
  });

  it('still works outside a dashboard', () => {
    expect(isNavActive('/chores', '/chores')).toBe(true);
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/', '/chores')).toBe(false);
  });

  it('does not match a different page that starts with the same name', () => {
    expect(isNavActive('/meals', '/mealsomething')).toBe(false);
  });
});
