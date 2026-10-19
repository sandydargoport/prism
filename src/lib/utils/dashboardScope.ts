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
 * Settings is the one destination with no scoped twin, and deliberately so. It
 * is a single, instance-wide page (there is no such thing as "the kitchen's
 * settings"), and it is where the scale is changed, so rendering it at a
 * display's 150% is the one place being too large is actively unhelpful.
 *
 * But leaving the `/d/<slug>` path used to discard the slug entirely, so after
 * a settings visit every link reverted to the default dashboard (#660). The
 * slug therefore rides along as a `?from=` return token: Settings stays one
 * global page at one path, the slug is never lost, navigation returns to the
 * display, and the page still renders unscoped because the zoom is keyed on the
 * path, not the token.
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

/** The query key that carries the display a settings visit should return to. */
export const RETURN_PARAM = 'from';

/** The read side of URLSearchParams / Next's ReadonlyURLSearchParams. */
export type ReadableParams = {
  get(key: string): string | null;
};

/** The dashboard slug the given path is inside, if any. */
export function dashboardSlug(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = /^\/d\/([^/]+)/.exec(pathname);
  return m ? m[1]! : null;
}

/**
 * The dashboard currently in effect: the one named in the path, or, on a page
 * that carries a `?from=` return token (Settings), the one the visit came from.
 */
export function effectiveSlug(
  pathname: string | null | undefined,
  search?: ReadableParams | null
): string | null {
  const fromPath = dashboardSlug(pathname);
  if (fromPath) return fromPath;
  const token = search?.get(RETURN_PARAM)?.trim();
  return token ? token : null;
}

/**
 * Rewrite a top-level href to stay inside the current dashboard.
 *
 * Returns the href unchanged when there is no dashboard to stay inside. The
 * Settings link keeps the slug as a return token rather than a path segment,
 * so the one global settings page is never scoped but the slug is never lost.
 */
export function scopedHref(
  href: string,
  pathname: string | null | undefined,
  search?: ReadableParams | null
): string {
  const slug = effectiveSlug(pathname, search);
  if (!slug) return href;
  if (href === '/') return `/d/${slug}`;
  if (href === '/settings') return `/settings?${RETURN_PARAM}=${encodeURIComponent(slug)}`;
  if (!(SCOPED_ROUTES as readonly string[]).includes(href)) return href;
  return `/d/${slug}${href}`;
}

/**
 * Whether a nav destination is the page currently open.
 *
 * Compared against the scoped href, not the bare one: inside a dashboard the
 * path is `/d/kitchen/chores`, which does not begin with `/chores`, so matching
 * on the raw href left every item unhighlighted the moment you were in a
 * dashboard. Settings is matched on its path alone, since the return token is
 * navigation state, not part of which page is open.
 */
export function isNavActive(
  href: string,
  pathname: string | null | undefined,
  search?: ReadableParams | null
): boolean {
  const path = pathname ?? '';
  if (href === '/settings') return path === '/settings';
  const slug = effectiveSlug(path, search);
  if (href === '/') return path === (slug ? `/d/${slug}` : '/');
  const target =
    slug && (SCOPED_ROUTES as readonly string[]).includes(href) ? `/d/${slug}${href}` : href;
  return path === target || path.startsWith(`${target}/`);
}
