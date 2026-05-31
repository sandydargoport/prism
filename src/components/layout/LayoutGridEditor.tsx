'use client';

import * as React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { PaintBucket, Square, Type } from 'lucide-react';
import { isLightColor } from '@/lib/utils/color';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { useTheme } from '@/components/providers';
import { getColorPalette, FIXED_COLORS, PALETTE_ORDER, type PaletteId } from '@/lib/constants/colorPalettes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
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
  gridHelperText,
  className,
  screenGuideOrientation: screenGuideOrientationProp,
  enabledSizes: enabledSizesProp,
  onScrollInfo,
  scrollToRef,
}: LayoutGridEditorProps) {
  const { zones: SAFE_ZONES, allSizeNames } = useScreenSafeZones();
  const cols = GRID_COLS;
  const containerPadding = 12;
  const margin = marginProp;
  const { width, containerRef, mounted, cellSize: rawCellSize } = useSquareCells(cols, containerPadding, margin);
  const { height: viewportHeight } = useViewportSize();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement | null>(null);
  const [colorTarget, setColorTarget] = useState<'fill' | 'outline' | 'text'>('fill');
  const [openPopover, setOpenPopover] = useState<'fill' | 'outline' | 'text' | 'grid' | null>(null);
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
  const [paletteId, setPaletteId] = useState<PaletteId>('seasonal');
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

  const layoutRef = useRef(layout);
  const layoutJson = JSON.stringify(layout);
  const stableLayout = useMemo(() => {
    layoutRef.current = layout;
    return layout;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutJson]);

  const updateWidgetColor = useCallback((widgetId: string, updates: { backgroundColor?: string | null; backgroundOpacity?: number; outlineColor?: string | null; outlineOpacity?: number; textColor?: string | null; textOpacity?: number; textScale?: number; gridLineOpacity?: number; cellBackgroundColor?: string | null; cellBackgroundOpacity?: number }) => {
    const updated = layoutRef.current.map(w => {
      if (w.i === widgetId) {
        return {
          ...w,
          backgroundColor: updates.backgroundColor === null ? undefined : (updates.backgroundColor ?? w.backgroundColor),
          backgroundOpacity: updates.backgroundOpacity ?? w.backgroundOpacity,
          outlineColor: updates.outlineColor === null ? undefined : (updates.outlineColor ?? w.outlineColor),
          outlineOpacity: updates.outlineOpacity ?? w.outlineOpacity,
          textColor: updates.textColor === null ? undefined : (updates.textColor ?? w.textColor),
          textOpacity: updates.textOpacity ?? w.textOpacity,
          textScale: updates.textScale ?? w.textScale,
          gridLineOpacity: updates.gridLineOpacity ?? w.gridLineOpacity,
          cellBackgroundColor: updates.cellBackgroundColor === null ? undefined : (updates.cellBackgroundColor ?? w.cellBackgroundColor),
          cellBackgroundOpacity: updates.cellBackgroundOpacity ?? w.cellBackgroundOpacity,
        };
      }
      return w;
    });
    onLayoutChange(updated);
  }, [onLayoutChange]);

  // Clear selection when widget becomes invisible
  useEffect(() => {
    if (selectedWidget && !layout.find(w => w.i === selectedWidget && w.visible !== false)) {
      setSelectedWidget(null);
    }
  }, [selectedWidget, layout]);

  const selectedWidgetConfig = selectedWidget
    ? layoutRef.current.find(w => w.i === selectedWidget && w.visible !== false)
    : null;

  // Get current color value for whichever target is active
  const getActiveColor = (widget: WidgetConfig): string | undefined => {
    if (colorTarget === 'fill') return widget.backgroundColor;
    if (colorTarget === 'outline') return widget.outlineColor;
    return widget.textColor;
  };

  // Apply a color to whichever target is active
  const applyColorToTarget = (widgetId: string, color: string | null) => {
    if (colorTarget === 'fill') {
      updateWidgetColor(widgetId, { backgroundColor: color });
    } else if (colorTarget === 'outline') {
      updateWidgetColor(widgetId, { outlineColor: color });
    } else {
      updateWidgetColor(widgetId, { textColor: color });
    }
  };

  // Helper: render a Harvey ball indicator
  const renderHarveyBall = (color: string | undefined, opacity: number, size = 16) => {
    const fillColor = color && color !== 'transparent' && color !== 'frosted' ? color : (color === 'frosted' ? '#b0c4de' : undefined);
    const fillLevel = !color || color === 'transparent' ? 0 : (color === 'frosted' ? 1 : opacity);
    if (!fillColor || fillLevel === 0) return null;
    const r = size / 2 - 1;
    const cx = size / 2;
    const cy = size / 2;
    const slices = Math.round(fillLevel * 4);
    if (slices >= 4) {
      return <svg viewBox={`0 0 ${size} ${size}`} className="w-3 h-3"><circle cx={cx} cy={cy} r={r} fill={fillColor} stroke={isLightColor(fillColor) ? '#333' : '#fff'} strokeWidth="0.5" /></svg>;
    }
    const endAngle = (slices / 4) * 2 * Math.PI - Math.PI / 2;
    const ex = cx + r * Math.cos(endAngle);
    const ey = cy + r * Math.sin(endAngle);
    const largeArc = slices > 2 ? 1 : 0;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-3 h-3">
        <circle cx={cx} cy={cy} r={r} fill="#e5e5e5" stroke="#999" strokeWidth="0.5" />
        <path d={`M${cx},${cx} L${cx},1 A${r},${r} 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)} Z`} fill={fillColor} stroke={isLightColor(fillColor) ? '#333' : '#fff'} strokeWidth="0.5" />
      </svg>
    );
  };

  // Helper: render color swatches popover content for fill/outline/text
  const renderColorPopover = (target: 'fill' | 'outline' | 'text') => {
    if (!selectedWidgetConfig || !selectedWidget) return null;
    const bgColor = selectedWidgetConfig.backgroundColor;
    const olColor = selectedWidgetConfig.outlineColor;
    const txtColor = selectedWidgetConfig.textColor;
    const bgOpacity = selectedWidgetConfig.backgroundOpacity ?? 1;
    const olOpacity = selectedWidgetConfig.outlineOpacity ?? 1;

    const color = target === 'fill' ? bgColor : target === 'outline' ? olColor : txtColor;
    const palette = getColorPalette(paletteId, isDark);
    const swatchColors = palette.colors;
    const fixedColors = paletteId === 'mono' ? [] : FIXED_COLORS;
    const isSelected = (hex: string) => color === hex;
    const apply = (c: string | null) => {
      if (target === 'fill') updateWidgetColor(selectedWidget, { backgroundColor: c });
      else if (target === 'outline') updateWidgetColor(selectedWidget, { outlineColor: c });
      else updateWidgetColor(selectedWidget, { textColor: c });
    };
    const reset = () => {
      if (target === 'fill') updateWidgetColor(selectedWidget, { backgroundColor: null, backgroundOpacity: 1 });
      else if (target === 'outline') updateWidgetColor(selectedWidget, { outlineColor: null, outlineOpacity: 1 });
      else updateWidgetColor(selectedWidget, { textColor: null, textOpacity: 1 });
    };
    const isDefault = !color;
    const hasColor = target === 'fill' ? (bgColor && bgColor !== 'transparent') : target === 'outline' ? !!olColor : false;
    const isFrosted = target === 'fill' && bgColor === 'frosted';

    return (
      <div className="p-2.5 space-y-2">
        {/* Palette pills */}
        <div className="flex gap-1 flex-wrap">
          {PALETTE_ORDER.map((id) => {
            const p = getColorPalette(id, isDark);
            return (
              <button key={id} onClick={() => setPaletteId(id)} onPointerDown={(e) => e.stopPropagation()}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors touch-manipulation ${paletteId === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent/50 text-muted-foreground'}`}
              >{p.label}</button>
            );
          })}
        </div>
        {/* Swatches */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Reset */}
          <button onClick={reset} onPointerDown={(e) => e.stopPropagation()}
            className={`w-7 h-7 rounded-full border border-gray-300 overflow-hidden transition-transform hover:scale-110 touch-manipulation ${isDefault ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            title="Default">
            <div className="w-full h-full bg-card/85 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            </div>
          </button>
          {/* Transparent (fill only) */}
          {target === 'fill' && (
            <button onClick={() => apply('transparent')} onPointerDown={(e) => e.stopPropagation()}
              className={`w-7 h-7 rounded-full border border-gray-300 overflow-hidden transition-transform hover:scale-110 touch-manipulation ${bgColor === 'transparent' ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              title="Transparent">
              <svg viewBox="0 0 32 32" className="w-full h-full"><pattern id="chk-pop" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#ccc" /><rect x="4" y="4" width="4" height="4" fill="#ccc" /><rect x="4" width="4" height="4" fill="#fff" /><rect y="4" width="4" height="4" fill="#fff" /></pattern><circle cx="16" cy="16" r="16" fill="url(#chk-pop)" /></svg>
            </button>
          )}
          {/* Frosted (fill only) */}
          {target === 'fill' && (
            <button onClick={() => apply('frosted')} onPointerDown={(e) => e.stopPropagation()}
              className={`w-7 h-7 rounded-full border border-gray-300 overflow-hidden transition-transform hover:scale-110 touch-manipulation ${bgColor === 'frosted' ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              title="Frosted glass">
              <svg viewBox="0 0 32 32" className="w-full h-full"><defs><radialGradient id="frost-pop" cx="30%" cy="30%"><stop offset="0%" stopColor="rgba(255,255,255,0.7)" /><stop offset="100%" stopColor="rgba(200,210,230,0.4)" /></radialGradient></defs><circle cx="16" cy="16" r="16" fill="url(#frost-pop)" /><circle cx="10" cy="12" r="4" fill="rgba(255,255,255,0.3)" /><circle cx="20" cy="18" r="3" fill="rgba(255,255,255,0.2)" /></svg>
            </button>
          )}
          <div className="w-px h-5 bg-border" />
          {swatchColors.map((hex) => (
            <button key={hex} onClick={() => apply(hex)} onPointerDown={(e) => e.stopPropagation()}
              className={`w-7 h-7 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation ${isSelected(hex) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              style={{ backgroundColor: hex }} title={hex} />
          ))}
          {fixedColors.map((hex) => (
            <button key={hex} onClick={() => apply(hex)} onPointerDown={(e) => e.stopPropagation()}
              className={`w-7 h-7 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation ${isSelected(hex) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              style={{ backgroundColor: hex }} title={hex} />
          ))}
          {/* Custom picker */}
          <div className="relative">
            <button onClick={() => colorPickerRef.current?.click()} onPointerDown={(e) => e.stopPropagation()}
              className="w-7 h-7 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation overflow-hidden"
              style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} title="Custom" />
            <input ref={(el) => { (colorPickerRef as React.MutableRefObject<HTMLInputElement | null>).current = el; }}
              type="color" className="sr-only" value={color || '#3B82F6'} onChange={(e) => apply(e.target.value)} />
          </div>
        </div>
        {/* Text scale (text only) */}
        {target === 'text' && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">Size</span>
            {[
              { value: 0.75, label: 'S' },
              { value: 1, label: 'M' },
              { value: 1.25, label: 'L' },
              { value: 1.5, label: 'XL' },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => updateWidgetColor(selectedWidget!, { textScale: value })} onPointerDown={(e) => e.stopPropagation()}
                className={`w-7 h-7 rounded-full text-[10px] border transition-colors touch-manipulation ${
                  (selectedWidgetConfig!.textScale ?? 1) === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/50'
                }`}>{label}</button>
            ))}
          </div>
        )}
        {/* Opacity (fill/outline only, not text) */}
        {target !== 'text' && (hasColor || isFrosted) && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">{isFrosted ? 'Blur' : 'Opacity'}</span>
            {isFrosted ? (
              [{ v: 0.25, l: 'Light' }, { v: 0.5, l: 'Med' }, { v: 0.75, l: 'Heavy' }, { v: 1, l: 'Max' }].map(({ v, l }) => (
                <button key={v} onClick={() => updateWidgetColor(selectedWidget, { backgroundOpacity: v })} onPointerDown={(e) => e.stopPropagation()}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors touch-manipulation ${bgOpacity === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent/50'}`}>{l}</button>
              ))
            ) : (
              [0, 0.25, 0.5, 0.75, 1].map((o) => {
                const cur = target === 'fill' ? bgOpacity : olOpacity;
                const set = () => target === 'fill' ? updateWidgetColor(selectedWidget, { backgroundOpacity: o }) : updateWidgetColor(selectedWidget, { outlineOpacity: o });
                return (
                  <button key={o} onClick={set} onPointerDown={(e) => e.stopPropagation()}
                    className={`w-7 h-7 rounded-full text-[10px] border transition-colors touch-manipulation ${cur === o ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent/50'}`}>{Math.round(o * 100)}%</button>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPropertiesBar = () => {
    if (!selectedWidgetConfig || !selectedWidget) return null;
    const bgColor = selectedWidgetConfig.backgroundColor;
    const olColor = selectedWidgetConfig.outlineColor;
    const txtColor = selectedWidgetConfig.textColor;
    const bgOpacity = selectedWidgetConfig.backgroundOpacity ?? 1;
    const olOpacity = selectedWidgetConfig.outlineOpacity ?? 1;
    const displayName = selectedWidgetConfig.i.charAt(0).toUpperCase() + selectedWidgetConfig.i.slice(1);
    const registryEntry = WIDGET_REGISTRY[selectedWidgetConfig.i];
    const widgetHasGrid = registryEntry?.hasGrid === true;

    return (
      <div className="bg-card/95 backdrop-blur-sm border-b border-border relative z-[150]" onPointerDown={(e) => e.stopPropagation()}>
        {/* Single row: Widget name + property buttons + close */}
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="text-sm font-medium mr-1">{displayName}</span>
          {([
            { id: 'fill' as const, icon: PaintBucket, label: 'Fill', color: bgColor, opacity: bgOpacity },
            { id: 'outline' as const, icon: Square, label: 'Outline', color: olColor, opacity: olOpacity },
            { id: 'text' as const, icon: Type, label: 'Text', color: txtColor, opacity: 1 },
          ]).map(({ id, icon: Icon, label, color, opacity }) => {
            const isOpen = openPopover === id;
            const indicator = renderHarveyBall(color, opacity);
            const hasValue = !!color && color !== 'transparent';

            return (
              <div key={id} className="relative">
                <button
                  onClick={() => { setColorTarget(id); setOpenPopover(isOpen ? null : id); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-md border transition-colors touch-manipulation min-h-[40px] ${
                    isOpen
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {indicator}
                  {/* Colored underline indicator */}
                  {hasValue && (
                    <div className="absolute bottom-0.5 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: color === 'frosted' ? '#b0c4de' : color! }} />
                  )}
                </button>
                {/* Popover */}
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 z-[200] bg-card border border-border rounded-lg shadow-lg min-w-[320px]">
                    {renderColorPopover(id)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Grid button (calendar only) */}
          {/* Grid button (calendar only) */}
          {widgetHasGrid && (() => {
            const isOpen = openPopover === 'grid';
            const gridLineOp = selectedWidgetConfig.gridLineOpacity ?? 1;
            const cellBgColor = selectedWidgetConfig.cellBackgroundColor;
            const cellBgOp = selectedWidgetConfig.cellBackgroundOpacity ?? 1;
            const hasGridConfig = gridLineOp < 1 || !!cellBgColor;
            const palette = getColorPalette(paletteId, isDark);
            const cellSwatches = palette.colors;

            return (
              <div className="relative">
                <button
                  onClick={() => setOpenPopover(isOpen ? null : 'grid')}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex items-center gap-1.5 px-2.5 py-2 text-xs rounded-md border transition-colors touch-manipulation min-h-[40px] ${
                    isOpen
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></svg>
                  <span>Grid</span>
                  {hasGridConfig && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
                {/* Grid popover */}
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 z-[200] bg-card border border-border rounded-lg shadow-lg min-w-[280px] p-2.5 space-y-2.5">
                    {/* Lines opacity */}
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Line Opacity</div>
                      <div className="flex items-center gap-1">
                        {[0, 0.25, 0.5, 0.75, 1].map((o) => (
                          <button key={o} onClick={() => updateWidgetColor(selectedWidget, { gridLineOpacity: o })} onPointerDown={(e) => e.stopPropagation()}
                            className={`w-8 h-8 rounded-full text-[10px] border transition-colors touch-manipulation ${gridLineOp === o ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent/50'}`}>{Math.round(o * 100)}%</button>
                        ))}
                      </div>
                    </div>
                    {/* Cell background */}
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Cell Background</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => updateWidgetColor(selectedWidget, { cellBackgroundColor: null, cellBackgroundOpacity: 1 })} onPointerDown={(e) => e.stopPropagation()}
                          className={`w-7 h-7 rounded-full border border-gray-300 overflow-hidden transition-transform hover:scale-110 touch-manipulation ${!cellBgColor ? 'ring-2 ring-primary ring-offset-1' : ''}`} title="Default">
                          <div className="w-full h-full bg-card/85 flex items-center justify-center">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                          </div>
                        </button>
                        {cellSwatches.slice(0, 6).map((hex) => (
                          <button key={hex} onClick={() => updateWidgetColor(selectedWidget, { cellBackgroundColor: hex })} onPointerDown={(e) => e.stopPropagation()}
                            className={`w-7 h-7 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation ${cellBgColor === hex ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                            style={{ backgroundColor: hex }} title={hex} />
                        ))}
                      </div>
                      {cellBgColor && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[10px] text-muted-foreground w-10 shrink-0">Opacity</span>
                          {[0, 0.1, 0.25, 0.5, 0.75, 1].map((o) => (
                            <button key={o} onClick={() => updateWidgetColor(selectedWidget, { cellBackgroundOpacity: o })} onPointerDown={(e) => e.stopPropagation()}
                              className={`w-7 h-7 rounded-full text-[9px] border transition-colors touch-manipulation ${cellBgOp === o ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent/50'}`}>{Math.round(o * 100)}%</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Spacer + close */}
          <div className="flex-1" />
          <button
            onClick={() => setSelectedWidget(null)}
            className="p-1 hover:bg-accent rounded transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
            aria-label="Close properties"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

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
    const safeZones = SAFE_ZONES[screenGuideOrientation].filter(z => enabledSizes.includes(z.name));
    const patternH = cellSize + margin;
    const patternW = cellSize + margin;

    const gridW = totalCols * patternW + containerPadding;
    const gridH = totalRows * patternH + containerPadding;

    return (
      <div
        className="absolute pointer-events-none z-[5]"
        style={{ left: containerPadding, top: containerPadding, width: gridW, height: gridH }}
      >
        {safeZones.map(zone => {
          const rectW = zone.cols * patternW - margin;
          const rectH = zone.rows * patternH - margin;
          // Corner bracket arm length: ~8% of the smaller dimension, clamped 18–44px
          const arm = Math.round(Math.min(Math.min(rectW, rectH) * 0.08, 44));
          const t = 5; // stroke thickness px
          const glow = `drop-shadow(0 0 4px ${zone.color}) drop-shadow(0 0 8px ${zone.color}bb)`;
          const cornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => ({
            position: 'absolute',
            width: arm,
            height: arm,
            borderColor: zone.color,
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
              key={`rect-${zone.name}`}
              className="absolute"
              style={{ left: 0, top: 0, width: rectW, height: rectH }}
            >
              <div style={cornerStyle('tl')} />
              <div style={cornerStyle('tr')} />
              <div style={cornerStyle('bl')} />
              <div style={cornerStyle('br')} />
              <span
                className="absolute text-[10px] px-1 py-0.5 rounded font-semibold"
                style={{
                  backgroundColor: zone.color,
                  color: 'white',
                  bottom: arm + 4,
                  right: 0,
                  filter: `drop-shadow(0 0 4px ${zone.color}) drop-shadow(0 1px 3px rgba(0,0,0,0.7))`,
                }}
              >
                {zone.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  }, [isEditable, mounted, width, cellSize, margin, screenGuideOrientation, enabledSizes, cols, totalRows, totalCols, containerPadding, SAFE_ZONES]);

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    containerRef(node);
  }, [containerRef]);

  if (isEditable) {
    return (
      <div className={className || ''}>
        {!measureMode && renderPropertiesBar()}
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
      layout={layout}
      renderWidget={renderWidget}
      margin={margin}
      containerPadding={containerPadding}
      cols={cols}
      headerOffset={headerOffset}
      bottomOffset={bottomOffset}
      minVisibleRows={minVisibleRows}
      className={className}
    />
  );
}
