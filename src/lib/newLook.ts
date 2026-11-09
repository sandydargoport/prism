/**
 * The new look for an existing household (#808): one tap adds Today and the
 * Calendar layout and makes Today the default. Nothing the family already has
 * is changed or removed; the old default is remembered so Settings can switch
 * back.
 */
import { TODAY_TEMPLATE } from '@/lib/constants/layoutTemplates';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/** The setting that remembers an accepted offer and the layout it replaced. */
export const NEW_LOOK_SETTING_KEY = 'newLook';
/** Per screen: the offer was put off here. */
export const NEW_LOOK_DISMISSED_KEY = 'prism-new-look-offer-dismissed';

export interface NewLookLayout {
  name: string;
  view: 'today' | 'calendar';
  widgets: WidgetConfig[];
  isDefault: boolean;
}

export interface NewLookPlan {
  create: NewLookLayout[];
  /** The layout that was the default, to switch back to. */
  previousDefaultId: string | null;
}

/** The two layouts a new install starts with, and an existing one is offered. */
export function newLookLayouts(): NewLookLayout[] {
  return [
    { name: 'Today', view: 'today', widgets: TODAY_TEMPLATE.widgets, isDefault: true },
    { name: 'Calendar', view: 'calendar', widgets: TODAY_TEMPLATE.widgets, isDefault: false },
  ];
}

/** What trying the new look would do to these layouts. */
export function planNewLook(layouts: Array<{ id: string; isDefault: boolean; view?: string }>): NewLookPlan {
  const haveToday = layouts.some((l) => l.view === 'today');
  const haveCalendar = layouts.some((l) => l.view === 'calendar');
  const create = newLookLayouts().filter((l) => (l.view === 'today' ? !haveToday : !haveCalendar));
  return { create, previousDefaultId: layouts.find((l) => l.isDefault)?.id ?? null };
}

/** Show the offer: setup is done, there is no Today yet, and it was not put off here. */
export function shouldOfferNewLook(layouts: Array<{ view?: string }>, accepted: boolean, dismissedHere: boolean): boolean {
  return !accepted && !dismissedHere && layouts.length > 0 && !layouts.some((l) => l.view === 'today');
}

/** Simple is the premade Today or Calendar page (#1117); anything else is Custom. */
export function isSimpleView(view: string | undefined | null): boolean {
  return view === 'today' || view === 'calendar';
}

/** What the new-look setting remembers: the old default, and each named screen's old dashboard. */
export interface NewLookSetting {
  previousDefaultId?: string | null;
  /** Per named screen (by id): the Custom dashboard it had before Simple. */
  screens?: Record<string, string>;
}

/**
 * Where Custom goes back to: the remembered dashboard while it is still a
 * Custom one, else the first Custom one there is, else nowhere.
 */
export function customTarget<L extends { id: string; view?: string }>(rememberedId: string | null | undefined, layouts: L[]): L | null {
  const remembered = layouts.find((l) => l.id === rememberedId);
  if (remembered && !isSimpleView(remembered.view)) return remembered;
  return layouts.find((l) => !isSimpleView(l.view)) ?? null;
}
