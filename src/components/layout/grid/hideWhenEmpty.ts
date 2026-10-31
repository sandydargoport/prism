import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/** Whether this kind of widget has an empty state to hide on (#738). */
export function canHideWhenEmpty(widgetId: string): boolean {
  return WIDGET_REGISTRY[widgetId]?.canBeEmpty === true;
}

/**
 * Whether a widget is hidden while it has nothing to show.
 *
 * `byDefault` is where it is drawn: true for the screensaver and a calm
 * dashboard's idle screen, where only what has something in it should show;
 * false for a dashboard in use, where a widget disappearing would surprise.
 * The widget's own setting wins either way.
 */
export function hidesWhenEmpty(widget: WidgetConfig, byDefault: boolean): boolean {
  return canHideWhenEmpty(widget.i) && (widget.hideWhenEmpty ?? byDefault);
}
