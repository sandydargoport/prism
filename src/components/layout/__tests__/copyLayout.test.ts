/**
 * Copying a layout between the dashboard and the screensaver.
 */
import { copyLayoutToOther } from '../copyLayout';
import { SCREENSAVER_WIDGETS, ALL_WIDGET_TYPES } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const w = (i: string, extra: Partial<WidgetConfig> = {}): WidgetConfig =>
  ({ i, x: 0, y: 0, w: 4, h: 4, visible: true, ...extra }) as WidgetConfig;

const notOnScreensaver = ALL_WIDGET_TYPES.find((id) => !SCREENSAVER_WIDGETS.some((s) => s.id === id))!;

describe('copyLayoutToOther', () => {
  it('copies every visible widget to the dashboard', () => {
    const r = copyLayoutToOther([w('clock'), w('weather', { x: 4 })], 'dashboard');
    expect(r.widgets.map((x) => x.i)).toEqual(['clock', 'weather']);
    expect(r.leftOut).toEqual([]);
  });

  it('leaves hidden widgets behind', () => {
    const r = copyLayoutToOther([w('clock'), w('weather', { visible: false })], 'dashboard');
    expect(r.widgets.map((x) => x.i)).toEqual(['clock']);
  });

  it('leaves out, and names, widgets the screensaver cannot show', () => {
    const r = copyLayoutToOther([w('clock'), w(notOnScreensaver)], 'screensaver');
    expect(r.widgets.map((x) => x.i)).toEqual(['clock']);
    expect(r.leftOut).toHaveLength(1);
  });

  it('keeps positions and sizes, as new objects', () => {
    const src = [w('calendar', { x: 8, y: 2, w: 20, h: 10 })];
    const r = copyLayoutToOther(src, 'screensaver');
    expect(r.widgets[0]).toMatchObject({ i: 'calendar', x: 8, y: 2, w: 20, h: 10 });
    expect(r.widgets[0]).not.toBe(src[0]);
  });
});
