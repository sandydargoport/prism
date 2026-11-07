/**
 * Small screens (#803): what drops out first, and how the rest grow.
 *
 * A grid layout is designed for a full-size wall (1920x1080, or 1080x1920
 * standing up). On a screen under SMALL_SCREEN_SCALE of that on its tighter
 * axis, a widget set to "Hide first" is left out, and the rows and columns that
 * only such widgets used close up. The grid fits itself to what is left, so the
 * remaining widgets stretch into the room. Rows or columns the design left
 * empty on purpose stay, and text never shrinks: it already has a floor.
 */
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/** Below this share of the design size, on the tighter axis, a screen is small. */
export const SMALL_SCREEN_SCALE = 0.75;
const DESIGN_LONG = 1920;
const DESIGN_SHORT = 1080;

export function isSmallScreen(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const wide = width >= height;
  const scale = Math.min(width / (wide ? DESIGN_LONG : DESIGN_SHORT), height / (wide ? DESIGN_SHORT : DESIGN_LONG));
  return scale < SMALL_SCREEN_SCALE;
}

/** Positions on one axis that only dropped widgets use. */
function freed(kept: WidgetConfig[], dropped: WidgetConfig[], start: 'x' | 'y', size: 'w' | 'h'): number[] {
  const used = new Set<number>();
  for (const w of kept) for (let i = w[start]; i < w[start] + w[size]; i++) used.add(i);
  const out = new Set<number>();
  for (const w of dropped) for (let i = w[start]; i < w[start] + w[size]; i++) if (!used.has(i)) out.add(i);
  return [...out].sort((a, b) => a - b);
}

/**
 * The layout as a small screen shows it: "Hide first" widgets marked not
 * visible, and the rows and columns only they used closed up. Unchanged when
 * nothing is set to hide, or when everything is.
 */
export function layoutForSmallScreen(layout: WidgetConfig[]): WidgetConfig[] {
  const shown = layout.filter((w) => w.visible !== false);
  const dropped = shown.filter((w) => w.hideOnSmallScreen === true);
  const kept = shown.filter((w) => w.hideOnSmallScreen !== true);
  if (dropped.length === 0 || kept.length === 0) return layout;

  const rows = freed(kept, dropped, 'y', 'h');
  const cols = freed(kept, dropped, 'x', 'w');
  // A kept widget never spans a freed row or column, so only its start moves.
  const shift = (gaps: number[], at: number) => gaps.filter((g) => g < at).length;
  const drop = new Set(dropped.map((w) => w.i));
  return layout.map((w) => {
    if (drop.has(w.i)) return { ...w, visible: false };
    if (w.visible === false) return w;
    return { ...w, x: w.x - shift(cols, w.x), y: w.y - shift(rows, w.y) };
  });
}
