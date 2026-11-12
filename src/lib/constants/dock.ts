/**
 * Which pages sit on the dock and which go behind More (#922). Pure, so the
 * rule that no page can be lost is tested without a screen.
 */
import type { NavItem } from './navItems';

/** The dock's pages, in order, when the household has not chosen (#925). */
export const DEFAULT_DOCK_HREFS = ['/', '/calendar', '/chores', '/shopping', '/meals', '/photos'] as const;

export const DOCK_SIZE = 6;
/** On a phone: five pages and More (#924). */
export const DOCK_SIZE_NARROW = 5;

/**
 * Split the visible pages into the dock and More. A household that has never
 * chosen gets the default six, topped up from the visible pages in their usual
 * order. Once the household has chosen, the dock is Home and exactly the
 * chosen pages that are visible, however few (#1173). More has every other
 * visible page. Settings always lives in More.
 */
export function dockLayout(
  visible: NavItem[],
  chosen?: readonly string[] | null,
  size: number = DOCK_SIZE,
): { dock: NavItem[]; more: NavItem[] } {
  const pages = visible.filter((i) => i.href !== '/settings');
  const byHref = new Map(pages.map((i) => [i.href, i]));
  const dock: NavItem[] = [];
  const hrefs = chosen ? ['/', ...chosen] : DEFAULT_DOCK_HREFS;
  for (const href of hrefs) {
    const item = byHref.get(href);
    if (item && !dock.includes(item) && dock.length < size) dock.push(item);
  }
  if (!chosen) for (const item of pages) if (dock.length < size && !dock.includes(item)) dock.push(item);
  const more = visible.filter((i) => !dock.includes(i));
  return { dock, more };
}
