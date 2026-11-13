/**
 * Today, the one built-in dashboard (#1151). A new install starts on it; it is
 * edited through its widgets list and cannot be deleted. Every other dashboard
 * is one a family arranged itself.
 *
 * The Simple/Custom choice and the one-time offer that came before it (#808,
 * #991, #1117) are gone, and with them the Calendar ready-made dashboard;
 * 0050 turned any saved one into a regular dashboard (#1154).
 */
import { TODAY_TEMPLATE } from '@/lib/constants/layoutTemplates';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface NewLookLayout {
  name: string;
  view: 'today';
  widgets: WidgetConfig[];
  isDefault: boolean;
}

/** What a new install starts with: Today, as the default. */
export function newLookLayouts(): NewLookLayout[] {
  return [{ name: 'Glance', view: 'today', widgets: TODAY_TEMPLATE.widgets, isDefault: true }];
}

/** The built-in dashboard: not deletable, editable, can be reset. */
export function isBuiltInView(view: string | undefined | null): boolean {
  return view === 'today';
}
