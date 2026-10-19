/**
 * Navigation has to stay inside the dashboard you are looking at.
 *
 * A dashboard carries its own font scale and its subpages honour it, but only
 * while the URL says which dashboard you are in. The navigation linked to
 * `/chores` rather than `/d/kitchen/chores`, so one tap left the dashboard and
 * the display dropped back to 100% — reported as scaling that "doesn't stay
 * when navigating between pages".
 */
import {
  scopedHref,
  isNavActive,
  dashboardSlug,
  effectiveSlug,
  SCOPED_ROUTES,
} from '../dashboardScope';

/** A URLSearchParams stands in for Next's ReadonlyURLSearchParams (both have .get). */
const params = (o: Record<string, string>) => new URLSearchParams(o);

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

  it('sends Settings to the global page but carries the display as a return token', () => {
    // Settings has no scoped twin: it is a single instance-wide page, and the
    // one place a display's 150% actively gets in the way. The slug rides along
    // as ?from= so leaving Settings still returns to the display (#660).
    expect(scopedHref('/settings', '/d/kitchen')).toBe('/settings?from=kitchen');
    expect(scopedHref('/settings', '/d/kitchen/chores')).toBe('/settings?from=kitchen');
    expect(SCOPED_ROUTES).not.toContain('/settings');
  });

  it('leaves Settings bare when not inside a dashboard', () => {
    expect(scopedHref('/settings', '/calendar')).toBe('/settings');
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

// The return token: on the global Settings page, the ?from= slug stands in for
// the path slug, so navigation leaves Settings back into the display (#660).
describe('effectiveSlug', () => {
  it('reads the slug from the path first', () => {
    expect(effectiveSlug('/d/kitchen/chores', params({ from: 'other' }))).toBe('kitchen');
  });

  it('falls back to the ?from= token when the path has no slug', () => {
    expect(effectiveSlug('/settings', params({ from: 'kitchen' }))).toBe('kitchen');
  });

  it('is null with neither a path slug nor a token', () => {
    expect(effectiveSlug('/settings')).toBe(null);
    expect(effectiveSlug('/settings', params({ from: '' }))).toBe(null);
  });
});

describe('navigation from the Settings page (return token)', () => {
  const onSettings = (slug: string) => params({ from: slug });

  it('re-scopes the other tabs back to the display', () => {
    expect(scopedHref('/calendar', '/settings', onSettings('kitchen'))).toBe('/d/kitchen/calendar');
    expect(scopedHref('/', '/settings', onSettings('kitchen'))).toBe('/d/kitchen');
  });

  it('keeps the token on the Settings tab itself', () => {
    expect(scopedHref('/settings', '/settings', onSettings('kitchen'))).toBe('/settings?from=kitchen');
  });

  it('highlights Settings as the open page, and only Settings', () => {
    expect(isNavActive('/settings', '/settings', onSettings('kitchen'))).toBe(true);
    expect(isNavActive('/calendar', '/settings', onSettings('kitchen'))).toBe(false);
    expect(isNavActive('/', '/settings', onSettings('kitchen'))).toBe(false);
  });

  it('leaves everything bare on a global Settings visit with no token', () => {
    expect(scopedHref('/calendar', '/settings')).toBe('/calendar');
    expect(scopedHref('/', '/settings')).toBe('/');
    expect(isNavActive('/settings', '/settings')).toBe(true);
  });
});
