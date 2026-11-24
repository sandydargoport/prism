/**
 * Which pages sit on the dock and which go behind More (#922). Pure, so the
 * rule that no page can be lost is tested without a screen.
 */
import type { NavItem } from './navItems';

/** The dock's pages, in order, when the household has not chosen (#925). */
export const DEFAULT_DOCK_HREFS = ['/', '/calendar', '/chores', '/shopping', '/meals', '/photos'] as const;

export const DOCK_SIZE = 6;

/**
 * One tile in the More panel (#1257): the same for a page, a screen job and
 * Settings, Help or Sign in. The icon above its name; h-auto undoes a
 * Button's fixed height.
 */
export const MORE_TILE = 'flex h-auto min-h-[64px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-caption font-medium text-foreground hover:bg-muted [&_svg]:size-5';
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

/**
 * More > This phone (#1354) asks the phone's dashboard of cards to open its
 * Cards sheet or start Reorder, once More has closed.
 */
export const PHONE_CARDS_EVENT = 'prism:phone-cards';
export const PHONE_REORDER_EVENT = 'prism:mobile-reorder';
