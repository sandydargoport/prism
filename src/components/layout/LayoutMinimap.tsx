'use client';

import * as React from 'react';
import { useMemo, useCallback } from 'react';

interface MinimapWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible?: boolean;
}

interface LayoutMinimapProps {
  layout: MinimapWidget[];
  cols: number;
  visibleRows: number;
  scrollY: number;
  onScrollTo: (y: number) => void;
  orientation: 'landscape' | 'portrait';
  enabledSizes: string[];
  className?: string;
}

// Screen-safe boundaries for common screen sizes
// rows = approximate visible rows, cols = effective usable columns
const SCREEN_SAFE_ZONES = {
  landscape: [
    { name: '15"', rows: 7, cols: 11, color: '#3B82F6' },    // Blue - laptop
    { name: '24"', rows: 8, cols: 12, color: '#EF4444' },    // Red - small monitor
    { name: '27"', rows: 10, cols: 12, color: '#F59E0B' },   // Amber - standard monitor
    { name: '32"', rows: 12, cols: 12, color: '#22C55E' }, // Green - large 4K monitor
  ],
  portrait: [
    { name: '15"', rows: 12, cols: 8, color: '#3B82F6' },
    { name: '24"', rows: 14, cols: 9, color: '#EF4444' },
    { name: '27"', rows: 18, cols: 10, color: '#F59E0B' },
    { name: '32"', rows: 22, cols: 12, color: '#22C55E' },
  ],
};

// Export safe zones for use in layout editors
export { SCREEN_SAFE_ZONES };

export function LayoutMinimap({
  layout,
  cols,
  visibleRows,
  scrollY,
  onScrollTo,
  orientation,
  enabledSizes,
  className = '',
}: LayoutMinimapProps) {
  // Calculate the total grid bounds
  const bounds = useMemo(() => {
    const visibleWidgets = layout.filter(w => w.visible !== false);
    if (visibleWidgets.length === 0) {
      return { maxY: visibleRows, hasOffScreen: false };
    }

    let maxY = 0;
    visibleWidgets.forEach(w => {
      const bottom = w.y + w.h;
      if (bottom > maxY) maxY = bottom;
    });

    // Add some padding
    maxY = Math.max(maxY + 2, visibleRows);

    return {
      maxY,
      hasOffScreen: maxY > visibleRows,
    };
  }, [layout, visibleRows]);

  // Get relevant screen-safe zones based on orientation and enabled sizes
  const safeZones = useMemo(() => {
    return SCREEN_SAFE_ZONES[orientation]
      .filter(z => enabledSizes.includes(z.name))
      .filter(z => z.rows <= bounds.maxY + 4);
  }, [orientation, enabledSizes, bounds.maxY]);

  // Calculate minimap scale
  const minimapHeight = 120;
  const minimapWidth = 160;
  const scale = Math.min(
    minimapWidth / cols,
    minimapHeight / bounds.maxY
  );

  const actualWidth = cols * scale;
  const actualHeight = bounds.maxY * scale;

  // Viewport indicator
  const viewportHeight = visibleRows * scale;
  const viewportTop = scrollY * scale;

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const targetRow = Math.floor((clickY / actualHeight) * bounds.maxY);
    const newScrollY = Math.max(0, targetRow - Math.floor(visibleRows / 2));
    onScrollTo(newScrollY);
  }, [actualHeight, bounds.maxY, visibleRows, onScrollTo]);

  const visibleWidgets = layout.filter(w => w.visible !== false);

  return (
    <div className={`relative ${className}`}>
      {/* Minimap */}
      <div
        className="relative bg-black/40 rounded border border-white/20 cursor-pointer"
        style={{ width: actualWidth, height: actualHeight }}
        onClick={handleMinimapClick}
      >
        {/* Screen-safe row guide lines (horizontal) */}
        {safeZones.map(zone => (
          <div
            key={`row-${zone.name}`}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: zone.rows * scale,
              borderTop: `1px dashed ${zone.color}`,
              opacity: 0.7,
            }}
            title={`${zone.name} height limit`}
          >
            <span
              className="absolute right-0 text-[6px] px-0.5 rounded-bl"
              style={{
                backgroundColor: zone.color,
                color: 'white',
                top: 0,
                transform: 'translateY(-100%)',
              }}
            >
              {zone.name}
            </span>
          </div>
        ))}

        {/* Screen-safe column guide lines (vertical) */}
        {safeZones.filter(z => z.cols < cols).map(zone => (
          <div
            key={`col-${zone.name}`}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: zone.cols * scale,
              borderLeft: `1px dashed ${zone.color}`,
              opacity: 0.7,
            }}
            title={`${zone.name} width limit`}
          >
            <span
              className="absolute bottom-0 text-[6px] px-0.5 rounded-tr"
              style={{
                backgroundColor: zone.color,
                color: 'white',
                left: 0,
                transform: 'translateX(-100%)',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
              }}
            >
              {zone.name}
            </span>
          </div>
        ))}

        {/* Render widget rectangles */}
        {visibleWidgets.map(w => (
          <div
            key={w.i}
            className="absolute bg-primary/60 border border-primary/80 rounded-[2px]"
            style={{
              left: w.x * scale,
              top: w.y * scale,
              width: w.w * scale - 1,
              height: w.h * scale - 1,
            }}
            title={w.i}
          />
        ))}

        {/* Viewport indicator */}
        <div
          className="absolute border-2 border-white/60 bg-white/10 rounded pointer-events-none"
          style={{
            left: 0,
            top: viewportTop,
            width: actualWidth,
            height: Math.min(viewportHeight, actualHeight - viewportTop),
          }}
        />

        {/* Off-screen indicator */}
        {visibleWidgets.some(w => w.y + w.h > visibleRows) && scrollY === 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-red-500/30 to-transparent flex items-end justify-center">
            <span className="text-[8px] text-red-300 mb-0.5">Widgets below</span>
          </div>
        )}
      </div>

      <div className="text-[9px] text-muted-foreground mt-1 text-center">
        Click to navigate
      </div>
    </div>
  );
}
