/**
 * Which pages sit on the dock and which go behind More (#922). Pure, so the
 * rule that no page can be lost is tested without a screen.
 */
import type { NavItem } from './navItems';

/** The dock's pages, in order, when the household has not chosen (#925). */
export const DEFAULT_DOCK_HREFS = ['/', '/calendar', '/chores', '/shopping', '/meals', '/photos'] as const;

export const DOCK_SIZE = 6;

/**
 * Split the visible pages into the dock and More. The dock takes the chosen
 * pages that are visible, topped up from the visible pages in their usual
 * order; More has every other visible page. Settings always lives in More.
 */
export function dockLayout(
  visible: NavItem[],
  chosen: readonly string[] = DEFAULT_DOCK_HREFS,
): { dock: NavItem[]; more: NavItem[] } {
  const pages = visible.filter((i) => i.href !== '/settings');
  const byHref = new Map(pages.map((i) => [i.href, i]));
  const dock: NavItem[] = [];
  for (const href of chosen) {
    const item = byHref.get(href);
    if (item && !dock.includes(item) && dock.length < DOCK_SIZE) dock.push(item);
  }
  for (const item of pages) if (dock.length < DOCK_SIZE && !dock.includes(item)) dock.push(item);
  const more = visible.filter((i) => !dock.includes(i));
  return { dock, more };
}
