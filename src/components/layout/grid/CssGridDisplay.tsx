'use client';

import { useEffect, useMemo } from 'react';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import { getWidgetStyle, getWidgetContentStyle, getTextColorClass } from './gridWidgetStyles';
import { useSquareCells } from './useSquareCells';
import { useViewportSize } from '@/lib/hooks/useViewportSize';
import { GRID_COLS } from '@/lib/constants/grid';
import type { CssGridDisplayProps } from './gridEditorTypes';

/**
 * Pure CSS Grid display for dashboard widgets. SSR-safe.
 * No drag/resize — used only for display mode and screensaver.
 */
export function CssGridDisplay({
  layout,
  renderWidget,
  margin = 8,
  containerPadding = 12,
  cols = GRID_COLS,
  fillHeight = false,
  headerOffset = 140,
  bottomOffset = 0,
  minVisibleRows = 0,
  targetRows,
  designOrientation,
  containMode = false,
  className,
}: CssGridDisplayProps) {
  const { containerRef, cellSize: widthCellSize, width, top, zoom, remeasure } = useSquareCells(cols, containerPadding, margin, fillHeight);
  const { width: viewportWidth, height: viewportHeight } = useViewportSize();

  // Re-read the grid's real top whenever the chrome offset changes (a toolbar
  // show/hide is a position change the ResizeObserver never sees), so the fill
  // math tracks the actual header height instead of a stale value.
  useEffect(() => { remeasure(); }, [headerOffset, bottomOffset, remeasure]);

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout],
  );

  // --- Fit-to-screen (targetRows set) --------------------------------------
  // The design is a fixed `cols × targetRows` canvas. How it maps onto the real
  // screen depends on whether the screen's orientation matches the design's:
  //   • SAME orientation (e.g. a landscape design on a landscape screen — the
  //     normal case): STRETCH both axes to fill. The layout always appears to
  //     fill the screen and nothing is clipped; widgets squish/elongate by only
  //     the small amount needed to absorb the aspect-ratio difference. This is
  //     what makes F11/fullscreen, a laptop browser, and a kiosk all look right.
  //   • OPPOSITE orientation (a portrait design on a landscape screen, or vice
  //     versa): a stretch would be a ~2× skew, so instead CONTAIN the canvas
  //     scaled-to-fit and letterbox it, preserving proportions.
  // The canvas we fit to the screen is the ACTUAL content bounding box (origin →
  // furthest used row/col), NOT the full guide. This is what makes the bottom
  // row and right column land on the screen edges: any trailing empty guide rows
  // the design didn't use are simply not part of the canvas, so they can't
  // become an awkward gap. Top/left margins the design left ARE preserved
  // (anchored at origin) and scale proportionally.
  const { fitCols, fitRows } = useMemo(() => {
    let maxCol = 1, maxRow = 1;
    for (const w of visibleWidgets) {
      if (w.x + w.w > maxCol) maxCol = w.x + w.w;
      if (w.y + w.h > maxRow) maxRow = w.y + w.h;
    }
    return { fitCols: maxCol, fitRows: maxRow };
  }, [visibleWidgets]);

  const fit = (!!targetRows || containMode) && !fillHeight;
  // Decide stretch-vs-letterbox from the CONTENT'S OWN SHAPE, not a stored
  // orientation label (which can drift from the actual widgets — e.g. a layout
  // saved as "portrait" but laid out landscape). A wide design on a wide screen
  // (or tall on tall) stretches to fill; a genuine orientation mismatch (wide
  // design on a tall screen or vice-versa) would be a ~2× skew, so it letterboxes
  // to preserve proportions. `designOrientation` is kept only as a fallback for
  // an empty/degenerate layout.
  const designWide = fitCols !== fitRows
    ? fitCols > fitRows
    : (designOrientation ? designOrientation === 'landscape' : true);
  const screenWide = viewportWidth >= viewportHeight;
  const sameOrientation = designWide === screenWide;
  // containMode always scales-to-fit (screensaver — sparse ambient layout that
  // should fit any screen without clipping); otherwise stretch when orientation
  // matches and letterbox only on a genuine mismatch.
  const stretch = fit && sameOrientation && !containMode;
  const contain = fit && (!sameOrientation || containMode);

  // Available box below the real chrome. Uses the measured grid top when we have
  // it (real header height) and the reactive viewport height so F11/fullscreen,
  // window resize and orientation change all re-fill automatically.
  //
  // BUT when the chrome is explicitly hidden (headerOffset 0 — auto-hide/kiosk),
  // trust that: the grid slides to the very top, yet the measured `top` only
  // re-reads on resize (a chrome hide is a position change, not a size change),
  // so it stays stale at ~56px and leaves ~1-2 empty rows at the bottom. When the
  // caller says the chrome is gone, the top is 0.
  // Take the LARGER of the measured grid-top and the caller's offset so we never
  // under-estimate the header (a taller touch-device header, or a not-yet-settled
  // measurement, used to let the bottom row clip). A small safety margin when
  // chrome is present absorbs any residual slop — better a hair of bottom gap
  // than a clipped row.
  // `top` is a getBoundingClientRect value (visual pixels) while the viewport
  // heights below are root pixels. Under a per-display font scale the dashboard
  // renders inside a `zoom` wrapper and those stop being the same unit, so the
  // grid budgeted its height unscaled and then drew it magnified — the bottom
  // of the dashboard ran off the screen, a whole widget at a time. Divide both
  // by the measured scale so the budget is computed in the grid's own space.
  // `zoom` is 1 on an unscaled display, so this is a no-op there.
  const localTop = top / zoom;
  const chromeTop = headerOffset <= 0 ? 0 : Math.max(localTop, headerOffset);
  // Some kiosk browsers over-report window.innerHeight vs the actually-visible
  // area (a device/browser bottom bar), which let the bottom row clip on a real
  // touch display even when the math looked right. Prefer the visual-viewport
  // height whenever it's smaller.
  const visualH = (typeof window !== 'undefined' && window.visualViewport)
    ? Math.min(viewportHeight, window.visualViewport.height)
    : viewportHeight;
  const localH = visualH / zoom;
  const bottomSafety = chromeTop > 0 ? Math.round(margin * 1.5) : 0;
  const availH = Math.max(120, localH - chromeTop - bottomOffset - bottomSafety);

  // Contain (letterbox) mode: largest square cell that fits the WHOLE content
  // canvas within the available box on both axes.
  const containCell = useMemo(() => {
    if (!contain || width <= 0) return widthCellSize;
    const innerW = width - 2 * containerPadding - (fitCols - 1) * margin;
    const innerH = availH - 2 * containerPadding - (fitRows - 1) * margin;
    return Math.max(8, Math.floor(Math.min(innerW / fitCols, innerH / fitRows)));
  }, [contain, width, availH, widthCellSize, fitCols, fitRows, containerPadding, margin]);

  // Legacy (no targetRows): fill width, adapt row count to the viewport.
  const legacyRows = useMemo(() => {
    if (fillHeight) return 12;
    if (viewportHeight <= 0) return 24;
    const available = viewportHeight / zoom - headerOffset - bottomOffset;
    return Math.max(minVisibleRows, Math.floor((available + margin) / (widthCellSize + margin)));
  }, [fillHeight, viewportHeight, zoom, headerOffset, bottomOffset, minVisibleRows, widthCellSize, margin]);

  // A little breathing room on the left in landscape, where the side nav rail
  // lives, so the first column isn't flush against it (and the rail's
  // expand/collapse has somewhere to go). Right/bottom keep their normal small
  // margin. Portrait has a bottom nav, so no left play there.
  const leftPlay = stretch && screenWide ? 20 : 0;

  // Resolve the container box + grid template for the active mode.
  let containerHeight: number | string;
  let centerContain = false;
  let gridStyle: React.CSSProperties;

  if (stretch) {
    // Fill the available box; columns AND rows flex (1fr) so the content canvas
    // stretches to fit — never clipped, always full-bleed to bottom + right.
    containerHeight = availH;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${fitCols}, 1fr)`,
      gridTemplateRows: `repeat(${fitRows}, 1fr)`,
      gap: `${margin}px`,
      paddingTop: containerPadding,
      paddingRight: containerPadding,
      paddingBottom: containerPadding,
      paddingLeft: containerPadding + leftPlay,
      width: '100%',
      height: '100%',
    };
  } else if (contain) {
    // Fixed-size, proportion-preserving canvas centered in the available box
    // (letterbox/pillarbox) — used only on an orientation mismatch.
    containerHeight = availH;
    centerContain = true;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${fitCols}, ${containCell}px)`,
      gridAutoRows: `${containCell}px`,
      gap: `${margin}px`,
      padding: `${containerPadding}px`,
      width: fitCols * containCell + (fitCols - 1) * margin + 2 * containerPadding,
      height: fitRows * containCell + (fitRows - 1) * margin + 2 * containerPadding,
    };
  } else {
    // Legacy: fill width, square cells, adaptive rows.
    containerHeight = fillHeight
      ? '100%'
      : legacyRows * widthCellSize + (legacyRows - 1) * margin + 2 * containerPadding;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridAutoRows: `${widthCellSize}px`,
      gap: `${margin}px`,
      padding: `${containerPadding}px`,
      height: '100%',
    };
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className || ''}`}
      style={{
        height: containerHeight,
        ...(centerContain ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
      }}
    >
      <div style={gridStyle}>
        {visibleWidgets.map(w => {
          const widgetStyle = getWidgetStyle(w);
          const contentStyle = getWidgetContentStyle(w);
          const textClass = getTextColorClass(w);
          const hasCustomBg = !!w.backgroundColor;

          return (
            <div
              key={w.i}
              className={`widget-cell relative overflow-hidden ${textClass}`}
              data-widget={w.i}
              style={{
                gridColumn: `${w.x + 1} / span ${w.w}`,
                gridRow: `${w.y + 1} / span ${w.h}`,
                ...widgetStyle,
              }}
            >
              <WidgetBgOverrideProvider value={{ hasCustomBg, textColor: w.textColor, textOpacity: w.textOpacity, gridLineOpacity: w.gridLineOpacity, cellBackgroundColor: w.cellBackgroundColor, cellBackgroundOpacity: w.cellBackgroundOpacity }}>
                <div className="h-full w-full overflow-hidden" style={contentStyle}>
                  {renderWidget(w)}
                </div>
              </WidgetBgOverrideProvider>
            </div>
          );
        })}
      </div>
    </div>
  );
}
