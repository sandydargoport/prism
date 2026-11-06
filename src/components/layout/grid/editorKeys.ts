/**
 * Keyboard editing for the dashboard grid (#987). With a widget selected:
 * Delete or Backspace removes it; the arrow keys move it one cell, or, in
 * resize mode, grow it (right, down) or shrink it (left, up) by one cell.
 * Moves stop at the grid's edges; sizes stop at the widget's minimum and the
 * grid's right edge. Other widgets are not in the way, as with dragging.
 */
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export type EditorKeyResult =
  | { kind: 'remove'; layout: WidgetConfig[] }
  | { kind: 'change'; layout: WidgetConfig[] }
  | null;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/** Whether a key press belongs to a field the person is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const el = target as HTMLElement;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function editorKeyAction(
  layout: WidgetConfig[],
  id: string,
  mode: 'move' | 'resize',
  key: string,
  cols: number,
  min: { minW?: number; minH?: number } = {},
): EditorKeyResult {
  const w = layout.find((x) => x.i === id);
  if (!w) return null;

  if (key === 'Delete' || key === 'Backspace') {
    return { kind: 'remove', layout: layout.map((x) => (x.i === id ? { ...x, visible: false } : x)) };
  }

  const d = ARROWS[key];
  if (!d) return null;
  const [dx, dy] = d;
  const next = { x: w.x, y: w.y, w: w.w, h: w.h };
  if (mode === 'move') {
    next.x = Math.min(Math.max(0, w.x + dx), Math.max(0, cols - w.w));
    next.y = Math.max(0, w.y + dy);
  } else {
    next.w = Math.min(Math.max(min.minW ?? 1, w.w + dx), Math.max(1, cols - w.x));
    next.h = Math.max(min.minH ?? 1, w.h + dy);
  }
  if (next.x === w.x && next.y === w.y && next.w === w.w && next.h === w.h) return null;
  return { kind: 'change', layout: layout.map((x) => (x.i === id ? { ...x, ...next } : x)) };
}
