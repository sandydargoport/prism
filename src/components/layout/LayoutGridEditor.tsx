'use client';

import * as React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ResponsiveGridLayout as RGL, useContainerWidth, getCompactor } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import { isLightColor } from '@/lib/utils/color';
import { LayoutMinimap, SCREEN_SAFE_ZONES } from '@/components/layout/LayoutMinimap';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const overlapCompactor = getCompactor(null, true);

const COLOR_OPTIONS = [
  null,
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#FFFFFF', '#9CA3AF', '#6B7280', '#374151', '#000000',
];

const ALL_SIZES = ['15"', '24"', '27"', '32"'];

export interface EditorTheme {
  gridBg: string;
  gridStroke: string;
  gridOpacity: number;
  gridPatternId: string;
  borderDash: string;
}

const DASHBOARD_THEME: EditorTheme = {
  gridBg: '',
  gridStroke: 'currentColor',
  gridOpacity: 0.3,
  gridPatternId: 'grid-dash',
  borderDash: 'border-white/50 dark:border-white/40',
};

const SCREENSAVER_THEME: EditorTheme = {
  gridBg: 'bg-black/80',
  gridStroke: 'white',
  gridOpacity: 0.2,
  gridPatternId: 'grid-ss',
  borderDash: 'border-white/40',
};

export { DASHBOARD_THEME, SCREENSAVER_THEME };

export interface LayoutGridEditorProps {
  layout: WidgetConfig[];
  onLayoutChange: (layout: WidgetConfig[]) => void;
  isEditable?: boolean;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  widgetConstraints?: Record<string, { minW?: number; minH?: number }>;
  margin?: number;
  headerOffset?: number;
  minVisibleRows?: number;
  theme?: EditorTheme;
  gridHelperText?: string;
  className?: string;
  screenGuideOrientation?: 'landscape' | 'portrait';
  enabledSizes?: string[];
  onScrollInfo?: (info: { scrollY: number; visibleRows: number }) => void;
  scrollToRef?: React.MutableRefObject<((row: number) => void) | null>;
}

function ColorPickerButton({ bgColor, onClick }: { bgColor?: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="w-5 h-5 rounded-full shadow-md"
      style={{
        backgroundColor: bgColor || 'transparent',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.8), 0 0 0 2.5px rgba(0,0,0,0.3)',
      }}
      title="Widget settings"
    />
  );
}

export function LayoutGridEditor({
  layout,
  onLayoutChange,
  isEditable = false,
  renderWidget,
  widgetConstraints,
  margin: marginProp = 8,
  headerOffset = 140,
  minVisibleRows = 0,
  theme = DASHBOARD_THEME,
  gridHelperText,
  className,
  screenGuideOrientation: screenGuideOrientationProp,
  enabledSizes: enabledSizesProp,
  onScrollInfo,
  scrollToRef,
}: LayoutGridEditorProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [colorPickerWidget, setColorPickerWidget] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [screenGuideOrientationInternal, setScreenGuideOrientationInternal] = useState<'landscape' | 'portrait'>('landscape');
  const [enabledSizesInternal, setEnabledSizesInternal] = useState<string[]>(ALL_SIZES);
  const [showPanel, setShowPanel] = useState(true);

  const screenGuideOrientation = screenGuideOrientationProp ?? screenGuideOrientationInternal;
  const enabledSizes = enabledSizesProp ?? enabledSizesInternal;

  const cols = 12;
  const containerPadding = 12;
  const margin = marginProp;

  const cellSize = useMemo(() => {
    if (!mounted || width <= 0) return 60;
    const availableWidth = width - 2 * containerPadding - (cols - 1) * margin;
    return Math.floor(availableWidth / cols);
  }, [mounted, width, margin]);

  const visibleRows = useMemo(() => {
    if (typeof window === 'undefined') return 24;
    const availableHeight = window.innerHeight - headerOffset;
    return Math.max(minVisibleRows, Math.floor((availableHeight + margin) / (cellSize + margin)));
  }, [cellSize, margin, headerOffset, minVisibleRows]);

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
    const maxScreenRows = Math.max(...SCREEN_SAFE_ZONES[screenGuideOrientation].map(z => z.rows));
    const maxScreenCols = Math.max(...SCREEN_SAFE_ZONES[screenGuideOrientation].map(z => z.cols));
    return {
      totalRows: Math.max(maxY + 4, maxScreenRows + 2),
      totalCols: Math.max(maxX, cols, maxScreenCols + 2),
    };
  }, [layout, visibleRows, cols, screenGuideOrientation]);

  const handleScrollTo = useCallback((targetRow: number) => {
    if (scrollContainerRef.current) {
      const scrollTop = targetRow * (cellSize + margin);
      scrollContainerRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, [cellSize, margin]);

  // Expose scrollTo via ref
  useEffect(() => {
    if (scrollToRef) scrollToRef.current = handleScrollTo;
    return () => { if (scrollToRef) scrollToRef.current = null; };
  }, [scrollToRef, handleScrollTo]);

  // Report scroll info to parent
  useEffect(() => {
    onScrollInfo?.({ scrollY, visibleRows });
  }, [scrollY, visibleRows, onScrollInfo]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrolledRows = Math.floor(target.scrollTop / (cellSize + margin));
    setScrollY(scrolledRows);
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

  const rglLayout: LayoutItem[] = useMemo(
    () =>
      stableLayout
        .filter(w => w.visible !== false)
        .map(w => {
          const constraints = widgetConstraints?.[w.i];
          return {
            i: w.i,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            minW: constraints?.minW ?? 1,
            minH: constraints?.minH ?? 1,
          };
        }),
    [stableLayout, widgetConstraints]
  );

  const visibleWidgets = useMemo(
    () => stableLayout.filter(w => w.visible !== false),
    [stableLayout]
  );

  const handleLayoutChange = useMemo(() => {
    return (newLayout: Layout) => {
      const current = layoutRef.current;
      const updated: WidgetConfig[] = current.map(w => {
        const found = newLayout.find((l: LayoutItem) => l.i === w.i);
        if (found) {
          return { ...w, x: found.x, y: found.y, w: found.w, h: found.h };
        }
        return w;
      });
      onLayoutChange(updated);
    };
  }, [onLayoutChange]);

  const updateWidgetColor = useCallback((widgetId: string, updates: { backgroundColor?: string | null; backgroundOpacity?: number; outlineColor?: string | null }) => {
    const updated = layoutRef.current.map(w => {
      if (w.i === widgetId) {
        return {
          ...w,
          backgroundColor: updates.backgroundColor === null ? undefined : (updates.backgroundColor ?? w.backgroundColor),
          backgroundOpacity: updates.backgroundOpacity ?? w.backgroundOpacity,
          outlineColor: updates.outlineColor === null ? undefined : (updates.outlineColor ?? w.outlineColor),
        };
      }
      return w;
    });
    onLayoutChange(updated);
  }, [onLayoutChange]);

  const getWidgetStyle = (widget: WidgetConfig): React.CSSProperties | undefined => {
    if (!widget.backgroundColor && !widget.outlineColor) return undefined;
    const style: React.CSSProperties = { borderRadius: '0.5rem' };
    if (widget.backgroundColor) {
      style.backgroundColor = widget.backgroundColor;
      style.opacity = widget.backgroundOpacity ?? 1;
    }
    if (widget.outlineColor) {
      style.border = `2px solid ${widget.outlineColor}`;
    }
    return style;
  };

  const getTextClass = (widget: WidgetConfig, fallback: string) => {
    if (!widget.backgroundColor) return fallback;
    return isLightColor(widget.backgroundColor) ? 'text-black' : 'text-white';
  };

  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colorPickerWidget) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerWidget(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [colorPickerWidget]);

  const renderColorPicker = (widget: WidgetConfig) => {
    const bgColor = widget.backgroundColor;
    const olColor = widget.outlineColor;
    const bgOpacity = widget.backgroundOpacity ?? 1;
    const isOpen = colorPickerWidget === widget.i;

    return (
      <div className="absolute top-1 left-1 z-20" ref={isOpen ? colorPickerRef : undefined}>
        <ColorPickerButton
          bgColor={bgColor}
          onClick={(e) => { e.stopPropagation(); setColorPickerWidget(isOpen ? null : widget.i); }}
        />
        {isOpen && (
          <div className="absolute top-8 left-0 bg-card border border-border rounded-lg p-2 shadow-xl z-30 w-[200px] space-y-2" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Background</div>
              <div className="grid grid-cols-4 gap-1">
                {COLOR_OPTIONS.map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => updateWidgetColor(widget.i, { backgroundColor: c })}
                    className={`w-7 h-7 rounded-full border transition-transform hover:scale-110 ${
                      c === null ? 'bg-gradient-to-br from-white to-gray-400 border-gray-300' : 'border-gray-400'
                    } ${bgColor === c || (!bgColor && c === null) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    style={c ? { backgroundColor: c } : undefined}
                    title={c === null ? 'None' : c}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-1.5">
              <div className="text-[10px] text-muted-foreground mb-1">Outline</div>
              <div className="grid grid-cols-4 gap-1">
                {COLOR_OPTIONS.map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => updateWidgetColor(widget.i, { outlineColor: c })}
                    className={`w-7 h-7 rounded-full border transition-transform hover:scale-110 ${
                      c === null ? 'bg-gradient-to-br from-white to-gray-400 border-gray-300' : 'border-gray-400'
                    } ${olColor === c || (!olColor && c === null) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    style={c ? { backgroundColor: c } : undefined}
                    title={c === null ? 'None' : c}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-1.5">
              <div className="text-[10px] text-muted-foreground mb-1">Opacity</div>
              <div className="flex gap-1">
                {[1, 0.75, 0.5, 0.25].map((o) => (
                  <button
                    key={o}
                    onClick={() => updateWidgetColor(widget.i, { backgroundOpacity: o })}
                    className={`flex-1 py-0.5 text-[10px] rounded border transition-colors ${
                      bgOpacity === o
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    {Math.round(o * 100)}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
    const safeZones = SCREEN_SAFE_ZONES[screenGuideOrientation].filter(z => enabledSizes.includes(z.name));
    const patternH = cellSize + margin;
    const patternW = cellSize + margin;

    return (
      <div className="absolute inset-0 pointer-events-none z-[5]" style={{ left: containerPadding, top: containerPadding }}>
        {safeZones.map(zone => (
          <div
            key={`row-${zone.name}`}
            className="absolute left-0 right-0"
            style={{
              top: zone.rows * patternH - margin / 2,
              borderTop: `2px dashed ${zone.color}`,
              opacity: 0.6,
              marginRight: containerPadding,
            }}
          >
            <span
              className="absolute right-0 text-[10px] px-1 py-0.5 rounded-bl font-medium"
              style={{ backgroundColor: zone.color, color: 'white', top: 0, transform: 'translateY(-100%)' }}
            >
              {zone.name}
            </span>
          </div>
        ))}
        {safeZones.filter(z => z.cols < cols).map(zone => (
          <div
            key={`col-${zone.name}`}
            className="absolute top-0 bottom-0"
            style={{
              left: zone.cols * patternW - margin / 2,
              borderLeft: `2px dashed ${zone.color}`,
              opacity: 0.6,
              marginBottom: containerPadding,
            }}
          >
            <span
              className="absolute bottom-2 text-[10px] px-1 py-0.5 rounded-tr font-medium"
              style={{ backgroundColor: zone.color, color: 'white', left: 2 }}
            >
              {zone.name}
            </span>
          </div>
        ))}
      </div>
    );
  }, [isEditable, mounted, width, cellSize, margin, screenGuideOrientation, enabledSizes, cols]);

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (containerRef && 'current' in containerRef) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [containerRef]);

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
              <RGL
                className="layout"
                width={Math.max(width, totalCols * (cellSize + margin) + 2 * containerPadding)}
                layouts={{ lg: rglLayout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
                cols={{ lg: cols, md: 9, sm: 6, xs: 3 }}
                rowHeight={cellSize}
                compactor={overlapCompactor}
                dragConfig={{ enabled: true }}
                resizeConfig={{ enabled: true, handles: ['n', 's', 'e', 'w', 'ne', 'se', 'sw'] }}
                onLayoutChange={handleLayoutChange}
                containerPadding={[containerPadding, containerPadding]}
                margin={[margin, margin]}
              >
                {visibleWidgets.map(w => {
                  const widgetStyle = getWidgetStyle(w);
                  const textClass = getTextClass(w, '');

                  return (
                    <div key={w.i} className={`relative ${colorPickerWidget === w.i ? 'z-[100]' : ''}`} style={widgetStyle}>
                      <div className={`absolute inset-0 z-10 border-2 border-dashed ${theme.borderDash} rounded-lg pointer-events-none`} />
                      {renderColorPicker(w)}
                      <div className={`h-full w-full overflow-hidden ${textClass}`}>
                        {renderWidget(w)}
                      </div>
                    </div>
                  );
                })}
              </RGL>
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

  // Display mode (non-editable) - prevent scrolling beyond screen bounds
  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`relative overflow-hidden ${className || ''}`}
      style={{ height: '100%', maxHeight: '100vh' }}
    >
      {mounted && width > 0 ? (
        <div style={{ height: '100%' }}>
          <RGL
            className="layout"
            width={width}
            layouts={{ lg: rglLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: cols, md: 9, sm: 6, xs: 3 }}
            rowHeight={cellSize}
            compactor={overlapCompactor}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
            containerPadding={[containerPadding, containerPadding]}
            margin={[margin, margin]}
          >
            {visibleWidgets.map(w => {
              const widgetStyle = getWidgetStyle(w);
              const textClass = getTextClass(w, '');

              return (
                <div key={w.i} className="relative" style={widgetStyle}>
                  <div className={`h-full w-full overflow-hidden ${textClass}`}>
                    {renderWidget(w)}
                  </div>
                </div>
              );
            })}
          </RGL>
        </div>
      ) : (
        <div style={{ padding: 20, color: 'yellow' }}>
          Waiting for container width...
        </div>
      )}
    </div>
  );
}
