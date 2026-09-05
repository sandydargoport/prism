/**
 * Keeping navigation inside the dashboard you are looking at.
 *
 * A dashboard can carry its own font scale, and its subpages honour it — but
 * only while the URL says which dashboard you are in. The navigation linked to
 * `/chores` rather than `/d/kitchen/chores`, so one tap on the sidebar left the
 * dashboard's scope and the display dropped back to 100%. Reported as scaling
 * that "doesn't stay when navigating between pages", which is exactly what it
 * looked like from the outside.
 *
 * Not every destination has a scoped twin, and Settings deliberately does not:
 * it is where the scale is changed, and a settings page rendered at 150% is the
 * one place that being too large is actively unhelpful.
 */

/** Destinations that exist under `/d/[slug]` as well as at the top level. */
export const SCOPED_ROUTES = [
  '/calendar',
  '/tasks',
  '/chores',
  '/goals',
  '/shopping',
  '/meals',
  '/recipes',
  '/messages',
  '/photos',
  '/wishes',
  '/babysitter',
  '/travel',
  '/weekend',
] as const;

/** The dashboard slug the given path is inside, if any. */
export function dashboardSlug(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = /^\/d\/([^/]+)/.exec(pathname);
  return m ? m[1]! : null;
}

/**
 * Rewrite a top-level href to stay inside the current dashboard.
 *
 * Returns the href unchanged when there is no dashboard to stay inside, or when
 * the destination has no scoped route to go to.
 */
export function scopedHref(href: string, pathname: string | null | undefined): string {
  const slug = dashboardSlug(pathname);
  if (!slug) return href;
  if (href === '/') return `/d/${slug}`;
  if (!(SCOPED_ROUTES as readonly string[]).includes(href)) return href;
  return `/d/${slug}${href}`;
}

/**
 * Whether a nav destination is the page currently open.
 *
 * Compared against the scoped href, not the bare one: inside a dashboard the
 * path is `/d/kitchen/chores`, which does not begin with `/chores`, so matching
 * on the raw href left every item unhighlighted the moment you were in a
 * dashboard.
 */
export function isNavActive(href: string, pathname: string | null | undefined): boolean {
  const path = pathname ?? '';
  const target = scopedHref(href, path);
  if (href === '/') return path === target;
  return path === target || path.startsWith(`${target}/`);
}
