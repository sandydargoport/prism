import { SCREENSAVER_WIDGETS, WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const SCREENSAVER_IDS = new Set(SCREENSAVER_WIDGETS.map((w) => w.id));

/**
 * The widgets to put in the other layout when copying a dashboard to the
 * screensaver or back. Only visible widgets go across, as fresh objects so the
 * two layouts never share state. The screensaver shows a subset of widgets;
 * the rest are left out and named, so the user is told what did not come.
 */
export function copyLayoutToOther(
  source: readonly WidgetConfig[],
  target: 'dashboard' | 'screensaver',
): { widgets: WidgetConfig[]; leftOut: string[] } {
  const visible = source.filter((w) => w.visible !== false);
  const fits = (w: WidgetConfig) => target === 'dashboard' || SCREENSAVER_IDS.has(w.i);
  return {
    widgets: visible.filter(fits).map((w) => ({ ...w, visible: true })),
    leftOut: visible.filter((w) => !fits(w)).map((w) => WIDGET_REGISTRY[w.i]?.label ?? w.i),
  };
}
