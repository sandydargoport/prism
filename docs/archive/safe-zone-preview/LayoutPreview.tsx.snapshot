'use client';

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import type { ScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { GRID_COLS } from '@/lib/constants/grid';
import { DEFAULT_SCREEN_SAFE_ZONES } from '@/lib/hooks/useScreenSafeZones';

interface PreviewWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutPreviewProps {
  widgets: PreviewWidget[];
  width?: number;
  height?: number;
  cols?: number;
  highlightWidget?: string;
  showLabels?: boolean;
  showGrid?: boolean;
  className?: string;
  // Viewport indicator (scroll minimap)
  visibleRows?: number;
  scrollY?: number;
  visibleCols?: number;
  scrollX?: number;
  onScrollTo?: (row: number, col?: number) => void;
  // Screen guide lines
  screenGuideOrientation?: 'landscape' | 'portrait';
  enabledSizes?: string[];
  safeZones?: ScreenSafeZones;
}

// Consistent color palette for widget types
const WIDGET_COLORS: Record<string, string> = {
  clock: '#3B82F6',     // blue
  weather: '#06B6D4',   // cyan
  calendar: '#8B5CF6',  // violet
  tasks: '#22C55E',     // green
  messages: '#F59E0B',  // amber
  chores: '#EF4444',    // red
  shopping: '#EC4899',  // pink
  meals: '#F97316',     // orange
  birthdays: '#A855F7', // purple
  photos: '#14B8A6',    // teal
  points: '#EAB308',    // yellow
};

const WIDGET_LABELS: Record<string, string> = {
  clock: 'CLK',
  weather: 'WTR',
  calendar: 'CAL',
  tasks: 'TSK',
  messages: 'MSG',
  chores: 'CHR',
  shopping: 'SHP',
  meals: 'MEL',
  birthdays: 'BDY',
  photos: 'PHO',
  points: 'PTS',
};

/**
 * Compute the contain-fit layout for the preview minimap.
 * Uses a single scale factor for both axes (cells are always square).
 * Bounding box is computed from zones + widgets only (not viewport).
 * The viewport indicator clips naturally at content edges via overflow:hidden.
 *
 * @param maxPx — the longest edge in pixels (the other edge is derived from aspect ratio)
 */
export function computePreviewLayout(
  zones: { cols: number; rows: number }[],
  widgets: { x: number; y: number; w: number; h: number }[],
  cols: number,
  maxPx: number,
) {
  // Bounding box of zones + widgets in grid units
  let maxX = cols;
  let maxY = 1;
  for (const z of zones) {
    maxX = Math.max(maxX, z.cols);
    maxY = Math.max(maxY, z.rows);
  }
  for (const w of widgets) {
    maxX = Math.max(maxX, w.x + w.w);
    maxY = Math.max(maxY, w.y + w.h);
  }

  // Single scale: longest axis fills maxPx, shorter axis is proportional
  const scale = maxPx / Math.max(maxX, maxY);

  return { vbW: maxX, vbH: maxY, scale };
}

export function LayoutPreview({
  widgets,
  width = 160,
  height = 100,
  cols = GRID_COLS,
  highlightWidget,
  showLabels = true,
  showGrid = true,
  className = '',
  visibleRows,
  scrollY,
  visibleCols,
  scrollX,
  onScrollTo,
  screenGuideOrientation,
  enabledSizes,
  safeZones: safeZonesProp,
}: LayoutPreviewProps) {
  const ZONES = safeZonesProp ?? DEFAULT_SCREEN_SAFE_ZONES;

  const safeZones = useMemo(() => {
    if (!screenGuideOrientation || !enabledSizes) return [];
    return ZONES[screenGuideOrientation]
      .filter(z => enabledSizes.includes(z.name));
  }, [screenGuideOrientation, enabledSizes, ZONES]);

  const { vbW, vbH, scale } = useMemo(() => {
    return computePreviewLayout(safeZones, widgets, cols, Math.max(width, height));
  }, [safeZones, widgets, cols, width, height]);

  const contentW = vbW * scale;
  const contentH = vbH * scale;

  // Number of grid columns to draw (max of base cols and any zone that extends further)
  const gridCols = useMemo(() =>
    Math.max(cols, ...safeZones.map(z => z.cols)),
  [cols, safeZones]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onScrollTo || visibleRows == null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    // Convert pixel position to grid coordinates using the single scale
    const gridX = clickX / scale;
    const gridY = clickY / scale;
    const newScrollY = Math.max(0, Math.floor(gridY) - Math.floor(visibleRows / 2));
    const newScrollX = visibleCols != null
      ? Math.max(0, Math.floor(gridX) - Math.floor(visibleCols / 2))
      : 0;
    onScrollTo(newScrollY, visibleCols != null ? newScrollX : undefined);
  }, [onScrollTo, visibleRows, visibleCols, scale]);

  return (
    <div
      className={`relative bg-muted/50 rounded overflow-hidden ${onScrollTo ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: contentW, height: contentH, outline: '1px solid var(--border)' }}
      onClick={onScrollTo ? handleClick : undefined}
    >
      {/* Grid lines — within content area */}
      {showGrid && (
        <>
          {/* Vertical grid lines */}
          {Array.from({ length: gridCols - 1 }, (_, i) => (
            <div
              key={`gc-${i}`}
              className="absolute top-0 border-l border-border/30"
              style={{ left: (i + 1) * scale, height: contentH }}
            />
          ))}
          {/* Horizontal grid lines */}
          {Array.from({ length: Math.min(Math.ceil(vbH) - 1, 40) }, (_, i) => (
            <div
              key={`gr-${i}`}
              className="absolute left-0 border-t border-border/30"
              style={{ top: (i + 1) * scale, width: contentW }}
            />
          ))}
        </>
      )}

      {/* Screen guide rectangles */}
      {safeZones.map(zone => (
        <div
          key={zone.name}
          className="absolute pointer-events-none z-[2]"
          style={{
            left: 0,
            top: 0,
            width: zone.cols * scale,
            height: zone.rows * scale,
            border: `1.5px dashed ${zone.color}`,
            boxSizing: 'border-box',
            opacity: 0.7,
          }}
        >
          <span
            className="absolute text-[7px] px-0.5 rounded-tl font-medium pointer-events-none"
            style={{ backgroundColor: zone.color, color: 'white', bottom: 1, right: 1 }}
          >
            {zone.name}
          </span>
        </div>
      ))}

      {/* Widget rectangles */}
      {widgets.map(w => {
        const color = WIDGET_COLORS[w.i] || '#6B7280';
        const isHighlighted = highlightWidget === w.i;
        const pxW = w.w * scale;
        const pxH = w.h * scale;
        return (
          <div
            key={w.i}
            className="absolute rounded-[2px] flex items-center justify-center transition-all"
            style={{
              left: w.x * scale + 0.5,
              top: w.y * scale + 0.5,
              width: pxW - 1,
              height: pxH - 1,
              backgroundColor: `${color}${isHighlighted ? 'cc' : '80'}`,
              border: isHighlighted ? `2px solid ${color}` : `1px solid ${color}99`,
            }}
            title={w.i}
          >
            {showLabels && pxW > 16 && pxH > 10 && (
              <span
                className="text-white font-bold leading-none select-none"
                style={{ fontSize: Math.min(9, Math.min(pxW, pxH) * 0.35) }}
              >
                {WIDGET_LABELS[w.i] || w.i.slice(0, 3).toUpperCase()}
              </span>
            )}
          </div>
        );
      })}

      {/* Viewport indicator ("you are here" window) — clips at content edges via overflow:hidden */}
      {visibleRows != null && scrollY != null && (
        <div
          className="absolute pointer-events-none z-[3] border-2 border-black/70 dark:border-white/80 bg-white/25 dark:bg-white/15"
          style={{
            left: (scrollX ?? 0) * scale,
            top: scrollY * scale,
            width: (visibleCols ?? cols) * scale,
            height: visibleRows * scale,
          }}
        />
      )}
    </div>
  );
}

export { WIDGET_COLORS, WIDGET_LABELS };
