import type { CSSProperties } from 'react';
import { hexToRgba, isLightColor } from '@/lib/utils/color';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/**
 * Compute inline CSSProperties for a widget's background, outline, and text
 * color. Used by both CssGridDisplay and the editor.
 *
 * NOTE: `textScale` (zoom) is intentionally NOT included here anymore — it
 * lives in `getWidgetContentStyle` so it can be applied on the inner content
 * wrapper, NOT the grid-cell wrapper. Applying `zoom` to a CSS grid cell
 * sporadically fails to propagate into the rendered subtree on the
 * dashboard render path (visible bug: dashboard weather widget ignored
 * its textScale even though the screensaver's identical code path
 * honored it). Moving the zoom inward isolates it from the grid layout
 * algorithm and makes scaling deterministic across both views.
 */
export function getWidgetStyle(w: WidgetConfig): CSSProperties | undefined {
  if (!w.backgroundColor && !w.outlineColor && !w.textColor) return undefined;
  const style: CSSProperties = { borderRadius: '0.5rem' };

  if (w.backgroundColor === 'frosted') {
    // Blur intensity mapped from backgroundOpacity: 0.25=light, 0.5=med, 0.75=heavy, 1=max
    const intensity = w.backgroundOpacity ?? 0.5;
    const blurPx = Math.round(intensity * 24); // 6px to 24px
    const tintOpacity = 0.08 + intensity * 0.12; // 0.08 to 0.20
    style.backgroundColor = `rgba(255,255,255,${tintOpacity})`;
    style.backdropFilter = `blur(${blurPx}px) saturate(${1 + intensity * 0.3})`;
    (style as Record<string, string>).WebkitBackdropFilter = `blur(${blurPx}px) saturate(${1 + intensity * 0.3})`;
  } else if (w.backgroundColor && w.backgroundColor !== 'transparent') {
    const opacity = w.backgroundOpacity ?? 1;
    style.backgroundColor = opacity < 1
      ? hexToRgba(w.backgroundColor, opacity)
      : w.backgroundColor;
  }

  if (w.outlineColor) {
    const olOpacity = w.outlineOpacity ?? 1;
    style.border = `2px solid ${olOpacity < 1 ? hexToRgba(w.outlineColor, olOpacity) : w.outlineColor}`;
  }

  if (w.textColor) {
    const txtOpacity = w.textOpacity ?? 1;
    style.color = txtOpacity < 1
      ? hexToRgba(w.textColor, txtOpacity)
      : w.textColor;
  }

  return style;
}

/**
 * Style applied to the INSIDE wrapper of a widget cell (not the grid
 * cell itself). Currently just `zoom: textScale` — see getWidgetStyle for
 * the reason this is separated out.
 */
export function getWidgetContentStyle(w: WidgetConfig): CSSProperties | undefined {
  if (!w.textScale || w.textScale === 1) return undefined;
  // Tailwind text classes use rem (root-relative), which ignores parent
  // em/font-size — `zoom` scales everything (rem text, SVG dimensions,
  // layout boxes) proportionally without changing the cell's grid slot.
  return { zoom: w.textScale } as CSSProperties;
}

/**
 * Get a Tailwind text color class based on widget background luminance.
 * Returns empty string if widget has explicit textColor (applied via context).
 */
export function getTextColorClass(w: WidgetConfig, fallback = ''): string {
  if (w.textColor) return '';
  if (!w.backgroundColor || w.backgroundColor === 'transparent' || w.backgroundColor === 'frosted' || w.backgroundOpacity === 0) return fallback;
  return isLightColor(w.backgroundColor) ? 'text-black' : 'text-white';
}
