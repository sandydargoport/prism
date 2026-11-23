'use client';

import * as React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { GRID_COLS } from '@/lib/constants/grid';
import { CssGridDisplay } from './grid/CssGridDisplay';
import dynamic from 'next/dynamic';
const CssGridEditor = dynamic(() => import('./grid/CssGridEditor').then(m => ({ default: m.CssGridEditor })), { ssr: false });
import { useSquareCells } from './grid/useSquareCells';
import { useViewportSize } from '@/lib/hooks/useViewportSize';

export type { EditorTheme } from './grid/gridEditorTypes';
export { DASHBOARD_THEME, SCREENSAVER_THEME } from './grid/gridEditorTypes';
export type { LayoutGridEditorProps } from './grid/gridEditorTypes';

// Re-import for local use
import { DASHBOARD_THEME } from './grid/gridEditorTypes';
import type { LayoutGridEditorProps } from './grid/gridEditorTypes';

export function LayoutGridEditor({
  layout,
  onLayoutChange,
  isEditable = false,
  renderWidget,
  widgetConstraints,
  margin: marginProp = 8,
  headerOffset = 140,
  bottomOffset = 0,
  minVisibleRows = 0,
  theme = DASHBOARD_THEME,
  previewFit = 'stretch',
  fadedIds,
  idleClear,
  hideEmptyByDefault = false,
  drift,
  morph,
  idleToggles,
  gridHelperText,
  className,
  screenGuideOrientation: screenGuideOrientationProp,
  enabledSizes: enabledSizesProp,
  onScrollInfo,
  scrollToRef,
  selectedWidgetId: selectedWidgetIdProp,
  onSelectedWidgetChange,
}: LayoutGridEditorProps) {
  const { zones: SAFE_ZONES, allSizeNames } = useScreenSafeZones();
  const cols = GRID_COLS;
  const containerPadding = 12;
  const margin = marginProp;
  const { width, containerRef, mounted, cellSize: rawCellSize } = useSquareCells(cols, containerPadding, margin);
  const { height: viewportHeight } = useViewportSize();
  // The selected widget: the editor's own (#1323), so the Widgets panel can
  // show its settings, or kept here when nobody else asks.
  const [ownSelection, setOwnSelection] = useState<string | null>(null);
  const controlled = selectedWidgetIdProp !== undefined;
  const selectedId = controlled ? selectedWidgetIdProp : ownSelection;
  const setSelectedWidget = useCallback((id: string | null) => {
    if (!controlled) setOwnSelection(id);
    onSelectedWidgetChange?.(id);
  }, [controlled, onSelectedWidgetChange]);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureHideNav, setMeasureHideNav] = useState(true);
  const [previewZoneIndex, setPreviewZoneIndex] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (typeof d === 'boolean') {
        setMeasureMode(d);
        setMeasureHideNav(d);
      } else {
        setMeasureMode(d.active);
        setMeasureHideNav(d.active && d.hideNav);
        if (typeof d.zoneIndex === 'number') setPreviewZoneIndex(d.zoneIndex);
      }
    };
    window.addEventListener('prism:measure-mode', handler);
    return () => window.removeEventListener('prism:measure-mode', handler);
  }, []);
  const [scrollY, setScrollY] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [screenGuideOrientationInternal, setScreenGuideOrientationInternal] = useState<'landscape' | 'portrait'>('landscape');
  const [enabledSizesInternal, setEnabledSizesInternal] = useState<string[]>(allSizeNames);

  const screenGuideOrientation = screenGuideOrientationProp ?? screenGuideOrientationInternal;
  const enabledSizes = enabledSizesProp ?? enabledSizesInternal;

  // In measure mode, scale cell size so the active safe zone fills the available viewport.
  // This way the zone expands/contracts automatically when nav/toolbar hide or reappear —
  // no need to configure separate "with bars" vs "without bars" safe zones.
  const cellSize = useMemo(() => {
    if (!measureMode || !mounted || width <= 0) return rawCellSize;

    const activeSafeZones = SAFE_ZONES[screenGuideOrientation].filter(z => enabledSizes.includes(z.name));
    const zone = activeSafeZones[previewZoneIndex] ?? activeSafeZones[0];
    if (!zone) return rawCellSize;

    const effectiveHeaderOffset = measureHideNav ? 0 : 50;
    const effectiveBottomOffset = measureHideNav ? 0 : bottomOffset;
    const availableH = viewportHeight - effectiveHeaderOffset - effectiveBottomOffset - 2 * containerPadding;
    const availableW = width - 2 * containerPadding;

    // Cell size that makes zone.rows fill availableH, and zone.cols fill availableW
    const hCell = Math.floor((availableH + margin) / zone.rows) - margin;
    const wCell = Math.floor((availableW + margin) / zone.cols) - margin;

    return Math.max(16, Math.min(hCell, wCell));
  }, [measureMode, mounted, rawCellSize, SAFE_ZONES, screenGuideOrientation, enabledSizes, previewZoneIndex, measureHideNav, bottomOffset, margin, containerPadding, width, viewportHeight]);

  const visibleRows = useMemo(() => {
    if (viewportHeight <= 0) return 24;
    // Measure mode: toolbar always hidden; header + nav depend on hideNav toggle
    // measureHideNav=true: all chrome hidden (0 offset)
    // measureHideNav=false: header (~50px) + nav visible (bottomOffset)
    // Not in measure mode: full headerOffset (toolbar+header) + bottomOffset
    const effectiveHeaderOffset = measureMode
      ? (measureHideNav ? 0 : 50)
      : headerOffset;
    const effectiveBottomOffset = measureHideNav ? 0 : bottomOffset;
    const offset = effectiveHeaderOffset + effectiveBottomOffset;
    const availableHeight = viewportHeight - offset;
    return Math.max(minVisibleRows, Math.floor((availableHeight + margin) / (cellSize + margin)));
  }, [cellSize, margin, headerOffset, bottomOffset, minVisibleRows, measureMode, measureHideNav, viewportHeight]);

  const visibleCols = useMemo(() => {
    if (width <= 0) return cols;
    return Math.floor((width - 2 * containerPadding + margin) / (cellSize + margin));
  }, [width, cellSize, margin]);

  // Canonical target row count of the design (tallest configured screen for this
  // orientation, e.g. 27 for 1080p landscape). In display mode the grid renders
  // this exact canvas scaled-to-fit the real viewport, so a laptop browser and a
  // fullscreen kiosk show the same layout (just different scale) instead of
  // gaining/losing rows and clipping.
  const displayTargetRows = useMemo(() => {
    const zones = SAFE_ZONES[screenGuideOrientation];
    if (!zones?.length) return undefined;
    return Math.max(...zones.map(z => z.rows));
  }, [SAFE_ZONES, screenGuideOrientation]);

  const { totalRows, totalCols } = useMemo(() => {
    let maxY = visibleRows;
    let maxX = cols;
    layout.forEach(w => {
      if (w.visible !== false) {
        const bottom = w.y + w.h;
        const right = w.x + w.w;
        if (bottom > maxY) maxY = bottom;
        if (right > maxX) maxX = right;
      }
    });
    // Ensure grid extends to show all screen size guides
    const maxScreenRows = Math.max(...SAFE_ZONES[screenGuideOrientation].map(z => z.rows));
    // Buffer: at least 20 rows (or half a screen) below bottom-most widget
    // so touch users can scroll far enough to select/drag/resize lower widgets
    const scrollBuffer = Math.max(20, Math.ceil(visibleRows / 2));
    return {
      totalRows: Math.max(maxY + scrollBuffer, maxScreenRows + 4),
      totalCols: Math.max(maxX, cols),
    };
  }, [layout, visibleRows, cols, screenGuideOrientation, SAFE_ZONES]);

  const handleScrollTo = useCallback((targetRow: number, targetCol?: number) => {
    if (scrollContainerRef.current) {
      const scrollTop = targetRow * (cellSize + margin);
      const opts: ScrollToOptions = { top: scrollTop, behavior: 'smooth' };
      if (targetCol != null) {
        opts.left = targetCol * (cellSize + margin);
      }
      scrollContainerRef.current.scrollTo(opts);
    }
  }, [cellSize, margin]);

  // Expose scrollTo via ref
  useEffect(() => {
    if (scrollToRef) scrollToRef.current = handleScrollTo;
    return () => { if (scrollToRef) scrollToRef.current = null; };
  }, [scrollToRef, handleScrollTo]);

  // Report scroll info to parent
  useEffect(() => {
    onScrollInfo?.({ scrollY, visibleRows, scrollX, visibleCols, totalRows, totalCols });
  }, [scrollY, visibleRows, scrollX, visibleCols, totalRows, totalCols, onScrollInfo]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrolledRows = Math.floor(target.scrollTop / (cellSize + margin));
    const scrolledCols = Math.floor(target.scrollLeft / (cellSize + margin));
    setScrollY(scrolledRows);
    setScrollX(scrolledCols);
  }, [cellSize, margin]);

  const toggleSize = useCallback((size: string) => {
    setEnabledSizesInternal(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  }, []);

  const layoutJson = JSON.stringify(layout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLayout = useMemo(() => layout, [layoutJson]);

  // A widget that is hidden or removed is no longer selected. Its own
  // settings are in the Widgets panel (#1323), so the canvas shows only the
  // screen.
  const selectedWidget = selectedId && stableLayout.some(w => w.i === selectedId && w.visible !== false)
    ? selectedId
    : null;

  const gridBackground = useMemo(() => {
    if (!isEditable || !mounted || width <= 0) return null;
    const patternW = cellSize + margin;
    const patternH = cellSize + margin;
    const gridHeight = totalRows * patternH + 2 * containerPadding;
    const gridWidth = totalCols * patternW + 2 * containerPadding;

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-0"
        width={gridWidth}
        height={gridHeight}
        style={{ opacity: theme.gridOpacity }}
      >
        <defs>
          <pattern id={theme.gridPatternId} width={patternW} height={patternH} patternUnits="userSpaceOnUse" x={containerPadding} y={containerPadding}>
            <rect width={cellSize} height={cellSize} fill="none" stroke={theme.gridStroke} strokeWidth="0.5" className={theme.gridStroke === 'currentColor' ? 'text-primary' : ''} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${theme.gridPatternId})`} />
      </svg>
    );
  }, [isEditable, mounted, width, cellSize, margin, totalRows, totalCols, theme]);

  const screenGuideLines = useMemo(() => {
    if (!isEditable || !mounted || width <= 0) return null;
    // Single canonical design-canvas frame (the primary screen). The dashboard
    // stretches this one design to fill ANY screen, so there's no longer a
    // per-resolution safe-zone overlay — just the bounds you design within.
    const primary = SAFE_ZONES[screenGuideOrientation]?.[0];
    if (!primary) return null;
    const patternH = cellSize + margin;
    const patternW = cellSize + margin;

    const gridW = totalCols * patternW + containerPadding;
    const gridH = totalRows * patternH + containerPadding;

    const rectW = primary.cols * patternW - margin;
    const rectH = primary.rows * patternH - margin;
    const color = primary.color;
    // Corner bracket arm length: ~8% of the smaller dimension, clamped 18–44px
    const arm = Math.round(Math.min(Math.min(rectW, rectH) * 0.08, 44));
    const t = 5; // stroke thickness px
    const glow = `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color}bb)`;
    const cornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => ({
      position: 'absolute',
      width: arm,
      height: arm,
      borderColor: color,
      borderStyle: 'solid',
      borderWidth: 0,
      ...(pos === 'tl' && { top: 0, left: 0, borderTopWidth: t, borderLeftWidth: t }),
      ...(pos === 'tr' && { top: 0, right: 0, borderTopWidth: t, borderRightWidth: t }),
      ...(pos === 'bl' && { bottom: 0, left: 0, borderBottomWidth: t, borderLeftWidth: t }),
      ...(pos === 'br' && { bottom: 0, right: 0, borderBottomWidth: t, borderRightWidth: t }),
      filter: glow,
    });

    return (
      <div
        className="absolute pointer-events-none z-5"
        style={{ left: containerPadding, top: containerPadding, width: gridW, height: gridH }}
      >
        <div className="absolute" style={{ left: 0, top: 0, width: rectW, height: rectH }}>
          <div style={cornerStyle('tl')} />
          <div style={cornerStyle('tr')} />
          <div style={cornerStyle('bl')} />
          <div style={cornerStyle('br')} />
          <span
            className="absolute text-3xs px-1 py-0.5 rounded font-semibold"
            style={{
              backgroundColor: color,
              color: 'white',
              bottom: arm + 4,
              right: 0,
              filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 1px 3px rgba(0,0,0,0.7))`,
            }}
          >
            Screen
          </span>
        </div>
      </div>
    );
  }, [isEditable, mounted, width, cellSize, margin, screenGuideOrientation, totalRows, totalCols, containerPadding, SAFE_ZONES]);

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    containerRef(node);
  }, [containerRef]);

  // Preview (measure) mode: render the REAL display — the same stretch-to-fill
  // CssGridDisplay the live dashboard uses — so the preview is true WYSIWYG
  // instead of a square-cell, letterboxed approximation. (The old multi-screen
  // safe-zone preview lives on in git history / the archived guide code if a
  // fixed-aspect fit is ever needed again for odd screens like iPad/e-readers.)
  //
  // No `className` here: the live display has no side margins, so a preview
  // inside them was narrower than the screen it claims to show.
  if (isEditable && measureMode) {
    const frame = SAFE_ZONES[screenGuideOrientation]?.[0];
    return (
      <div>
        {previewFit === 'contain' ? (
          <CssGridDisplay
            layout={stableLayout}
            renderWidget={renderWidget}
            margin={margin}
            containerPadding={containerPadding}
            cols={cols}
            containMode
            screenFrame={frame}
            hideEmptyByDefault={hideEmptyByDefault}
            headerOffset={measureHideNav ? 0 : 50}
            bottomOffset={measureHideNav ? 0 : bottomOffset}
          />
        ) : (
          <CssGridDisplay
            layout={stableLayout}
            renderWidget={renderWidget}
            margin={margin}
            containerPadding={containerPadding}
            cols={cols}
            headerOffset={measureHideNav ? 0 : 50}
            bottomOffset={measureHideNav ? 0 : bottomOffset}
            targetRows={displayTargetRows}
            designOrientation={screenGuideOrientation}
            hideEmptyByDefault={hideEmptyByDefault}
          />
        )}
      </div>
    );
  }

  if (isEditable) {
    return (
      <div className={className || ''}>
        <div
          ref={combinedRef}
          onScroll={handleScroll}
          className={`overflow-auto ${theme.gridBg}`}
          style={{ maxHeight: visibleRows * (cellSize + margin) + 2 * containerPadding }}
        >
          <div
            className="relative editing-mode"
            style={{
              minHeight: totalRows * (cellSize + margin) + 2 * containerPadding,
              minWidth: totalCols * (cellSize + margin) + 2 * containerPadding,
            }}
          >
            {gridBackground}
            {screenGuideLines}
            {gridHelperText && (
              <div className="absolute top-2 left-4 text-white/50 text-xs z-20">
                {gridHelperText}
              </div>
            )}
            {mounted && width > 0 ? (
              <CssGridEditor
                layout={stableLayout}
                onLayoutChange={onLayoutChange}
                renderWidget={renderWidget}
                widgetConstraints={widgetConstraints}
                cellSize={cellSize}
                margin={margin}
                containerPadding={containerPadding}
                cols={cols}
                totalRows={totalRows}
                totalCols={totalCols}
                selectedWidget={selectedWidget}
                onSelectWidget={setSelectedWidget}
                theme={theme}
                idleToggles={idleToggles}
                hideEmptyByDefault={hideEmptyByDefault}
              />
            ) : (
              <div style={{ padding: 20, color: 'yellow' }}>
                Waiting for container width...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Display mode (non-editable) — pure CSS Grid, SSR-safe
  return (
    <CssGridDisplay
      staged
      smallScreenDrop
      layout={layout}
      renderWidget={renderWidget}
      margin={margin}
      containerPadding={containerPadding}
      cols={cols}
      headerOffset={headerOffset}
      bottomOffset={bottomOffset}
      minVisibleRows={minVisibleRows}
      targetRows={displayTargetRows}
      designOrientation={screenGuideOrientation}
      fadedIds={fadedIds}
      idleClear={idleClear}
      hideEmptyByDefault={hideEmptyByDefault}
      drift={drift}
      morph={morph}
      className={className}
    />
  );
}
