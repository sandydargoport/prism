import {
  Home,
  Calendar,
  CheckSquare,
  ListChecks,
  Trophy,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  MessageSquare,
  ImageIcon,
  Gift,
  Baby,
  Globe,
  Trees,
  Settings,
} from 'lucide-react';

export interface NavItem {
  /** English label. Also the fallback if a translation key is missing. */
  label: string;
  /** Key under the `common` i18n namespace, e.g. 'nav.calendar'. */
  i18nKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** All navigation items in canonical order. */
export const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', i18nKey: 'nav.dashboard', href: '/', icon: Home },
  { label: 'Calendar', i18nKey: 'nav.calendar', href: '/calendar', icon: Calendar },
  { label: 'Tasks', i18nKey: 'nav.tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Chores', i18nKey: 'nav.chores', href: '/chores', icon: ListChecks },
  { label: 'Goals', i18nKey: 'nav.goals', href: '/goals', icon: Trophy },
  { label: 'Shopping', i18nKey: 'nav.shopping', href: '/shopping', icon: ShoppingCart },
  { label: 'Meals', i18nKey: 'nav.meals', href: '/meals', icon: UtensilsCrossed },
  { label: 'Recipes', i18nKey: 'nav.recipes', href: '/recipes', icon: ChefHat },
  { label: 'Messages', i18nKey: 'nav.messages', href: '/messages', icon: MessageSquare },
  { label: 'Photos', i18nKey: 'nav.photos', href: '/photos', icon: ImageIcon },
  { label: 'Wishes', i18nKey: 'nav.wishes', href: '/wishes', icon: Gift },
  { label: 'Babysitter', i18nKey: 'nav.babysitter', href: '/babysitter', icon: Baby },
  { label: 'Travel', i18nKey: 'nav.travel', href: '/travel', icon: Globe },
  { label: 'Weekend', i18nKey: 'nav.weekend', href: '/weekend', icon: Trees },
  { label: 'Settings', i18nKey: 'nav.settings', href: '/settings', icon: Settings },
];

/** Pages that can never be hidden. */
export const ALWAYS_VISIBLE_HREFS = new Set(['/', '/settings']);

/** Pages that are hideable (for the Features settings UI). */
export const HIDEABLE_NAV_ITEMS = ALL_NAV_ITEMS.filter(
  (item) => !ALWAYS_VISIBLE_HREFS.has(item.href)
);
