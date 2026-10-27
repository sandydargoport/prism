'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import { getWidgetStyle, getWidgetContentStyle, getTextColorClass } from './gridWidgetStyles';
import { useSquareCells } from './useSquareCells';
import { useViewportSize } from '@/lib/hooks/useViewportSize';
import { GRID_COLS } from '@/lib/constants/grid';
import { resolveFitMode, containGeometry } from './fitMode';
import type { CssGridDisplayProps } from './gridEditorTypes';
/** One figure eight, in seconds. The keyframes are prism-drift in globals.css. */
const DRIFT_PERIOD_S = 96;

/**
 * Where in the drift cycle a cell starts, in seconds (negative, so it is
 * already under way): the same point for every cell, taken from the wall
 * clock, so every widget on screen drifts in step however late it arrived.
 *
 * In step, because drifting out of step let neighbours move towards each other
 * and overlap: two widgets each 4 px out close a 4 px gap twice over. Moving
 * together keeps every gap exactly as designed, and every pixel still sees the
 * same movement, which is all the panel needs.
 */
function driftPhase(): number {
  return -((Date.now() / 1000) % DRIFT_PERIOD_S);
}

/**
 * Start or stop one cell's drift.
 *
 * Done to the element rather than rendered, for the sake of stopping. Taking
 * the animation away puts the cell straight back where it started, and a
 * widget that has drifted four pixels jumps four pixels the moment the display
 * wakes. So the cell is pinned where it is at that instant and eased home over
 * the same second the faded widgets take to come back.
 */
function setCellDrift(el: HTMLElement, want: boolean) {
  if ((el.dataset.drift !== undefined) === want) return;
  if (want) {
    el.style.transitionProperty = ''; // in case it was still easing home
    el.dataset.drift = '';
    el.style.animationDuration = `${DRIFT_PERIOD_S}s`;
    el.style.animationDelay = `${driftPhase()}s`;
    return;
  }
  const at = getComputedStyle(el).transform;
  delete el.dataset.drift;
  el.style.animationDuration = '';
  el.style.animationDelay = '';
  if (!at || at === 'none') return;
  el.style.transform = at;
  void el.offsetWidth; // commit the pinned position, or there is nothing to ease from
  el.style.transitionProperty = 'opacity, transform';
  el.style.transform = '';
  const done = (e: TransitionEvent) => {
    if (e.target !== el || e.propertyName !== 'transform') return;
    el.style.transitionProperty = '';
    el.removeEventListener('transitionend', done);
  };
  el.addEventListener('transitionend', done);
}

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
  screenFrame,
  fadedIds,
  drift = false,
  className,
}: CssGridDisplayProps) {
  const { containerRef, cellSize: widthCellSize, width, top, zoom, remeasure } = useSquareCells(cols, containerPadding, margin, fillHeight);
  const { width: viewportWidth, height: viewportHeight, visibleHeight } = useViewportSize();

  // Re-read the grid's real top whenever the chrome offset changes (a toolbar
  // show/hide is a position change the ResizeObserver never sees), so the fill
  // math tracks the actual header height instead of a stale value.
  useEffect(() => { remeasure(); }, [headerOffset, bottomOffset, remeasure]);

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout],
  );

  // A faded widget does not drift: there is nothing on screen to protect.
  const cells = useRef(new Map<string, HTMLDivElement>());
  useLayoutEffect(() => {
    for (const [id, el] of cells.current) {
      setCellDrift(el, drift && !fadedIds?.has(id));
    }
  }, [drift, fadedIds, visibleWidgets]);

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
    if (containMode && screenFrame) {
      maxCol = Math.max(maxCol, screenFrame.cols);
      maxRow = Math.max(maxRow, screenFrame.rows);
    }
    return { fitCols: maxCol, fitRows: maxRow };
  }, [visibleWidgets, containMode, screenFrame]);

  const screenWide = viewportWidth >= viewportHeight;
  const mode = resolveFitMode({
    fitCols, fitRows, targetRows, designOrientation, screenWide, containMode, fillHeight,
  });
  const stretch = mode === 'stretch';
  const contain = mode === 'contain';

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
  // height whenever it's smaller (useViewportSize tracks it, so it stays current).
  const localH = visibleHeight / zoom;
  const bottomSafety = chromeTop > 0 ? Math.round(margin * 1.5) : 0;
  const availH = Math.max(120, localH - chromeTop - bottomOffset - bottomSafety);

  // Contain (letterbox) mode: largest square canvas that fits the WHOLE content
  // within the available box on both axes.
  // Before the first measurement there is no width yet, so use the width-based
  // cell at full gap and padding.
  const containGeo = useMemo(() => {
    if (!contain || width <= 0) {
      return {
        cell: widthCellSize,
        gap: margin,
        padding: containerPadding,
        gridWidth: fitCols * widthCellSize + (fitCols - 1) * margin + 2 * containerPadding,
        gridHeight: fitRows * widthCellSize + (fitRows - 1) * margin + 2 * containerPadding,
      };
    }
    return containGeometry({ width, height: availH, cols: fitCols, rows: fitRows, margin, padding: containerPadding });
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
    // (letterbox/pillarbox), used only on an orientation mismatch.
    containerHeight = availH;
    centerContain = true;
    gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${fitCols}, ${containGeo.cell}px)`,
      gridAutoRows: `${containGeo.cell}px`,
      gap: `${containGeo.gap}px`,
      padding: `${containGeo.padding}px`,
      width: containGeo.gridWidth,
      height: containGeo.gridHeight,
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
          const faded = fadedIds?.has(w.i) ?? false;

          return (
            <div
              key={w.i}
              className={`widget-cell relative overflow-hidden ${textClass} transition-opacity duration-1000 motion-reduce:duration-200`}
              ref={(el) => { if (el) cells.current.set(w.i, el); else cells.current.delete(w.i); }}
              data-widget={w.i}
              data-faded={faded || undefined}
              aria-hidden={faded || undefined}
              style={{
                gridColumn: `${w.x + 1} / span ${w.w}`,
                gridRow: `${w.y + 1} / span ${w.h}`,
                ...widgetStyle,
                // Faded, not removed: the cell keeps its place in the grid, so
                // nothing around it reflows. A tap on it falls to the empty
                // grid, which wakes the display without pressing anything.
                ...(faded ? { opacity: 0, pointerEvents: 'none' as const } : {}),
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
