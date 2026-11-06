/**
 * @jest-environment jsdom
 */
import { editorKeyAction, isTypingTarget } from '../editorKeys';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const layout: WidgetConfig[] = [
  { i: 'clock', x: 2, y: 3, w: 4, h: 2 },
  { i: 'weather', x: 10, y: 0, w: 6, h: 4 },
] as WidgetConfig[];
const get = (r: ReturnType<typeof editorKeyAction>, id = 'clock') => r!.layout.find((w) => w.i === id)!;

describe('editorKeyAction (#987)', () => {
  it('Delete and Backspace remove the selected widget, leaving the rest', () => {
    for (const key of ['Delete', 'Backspace']) {
      const r = editorKeyAction(layout, 'clock', 'move', key, 16);
      expect(r?.kind).toBe('remove');
      expect(get(r).visible).toBe(false);
      expect(get(r, 'weather').visible).toBeUndefined();
    }
  });

  it('arrows move one cell in move mode', () => {
    expect(get(editorKeyAction(layout, 'clock', 'move', 'ArrowRight', 16))).toMatchObject({ x: 3, y: 3, w: 4, h: 2 });
    expect(get(editorKeyAction(layout, 'clock', 'move', 'ArrowUp', 16))).toMatchObject({ x: 2, y: 2 });
  });

  it('moves stop at the grid edges', () => {
    expect(editorKeyAction(layout, 'weather', 'move', 'ArrowUp', 16)).toBeNull();
    expect(editorKeyAction(layout, 'weather', 'move', 'ArrowRight', 16)).toBeNull();
  });

  it('arrows resize one cell in resize mode, within the minimum and the right edge', () => {
    expect(get(editorKeyAction(layout, 'clock', 'resize', 'ArrowRight', 16))).toMatchObject({ x: 2, w: 5 });
    expect(get(editorKeyAction(layout, 'clock', 'resize', 'ArrowDown', 16))).toMatchObject({ h: 3 });
    expect(get(editorKeyAction(layout, 'clock', 'resize', 'ArrowLeft', 16))).toMatchObject({ w: 3 });
    expect(editorKeyAction(layout, 'clock', 'resize', 'ArrowUp', 16, { minH: 2 })).toBeNull();
    expect(editorKeyAction(layout, 'weather', 'resize', 'ArrowRight', 16)).toBeNull();
  });

  it('other keys do nothing', () => {
    expect(editorKeyAction(layout, 'clock', 'move', 'a', 16)).toBeNull();
  });

  it('knows a field being typed in', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
  });
});
