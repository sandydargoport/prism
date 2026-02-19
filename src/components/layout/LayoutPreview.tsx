'use client';

import * as React from 'react';
import { useMemo } from 'react';

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

export function LayoutPreview({
  widgets,
  width = 160,
  height = 100,
  cols = 12,
  highlightWidget,
  showLabels = true,
  showGrid = true,
  className = '',
}: LayoutPreviewProps) {
  const { maxRow, scaleX, scaleY } = useMemo(() => {
    const maxR = Math.max(12, ...widgets.map(w => w.y + w.h));
    return {
      maxRow: maxR,
      scaleX: width / cols,
      scaleY: height / maxR,
    };
  }, [widgets, width, height, cols]);

  return (
    <div
      className={`relative bg-muted/50 rounded border border-border overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Grid lines */}
      {showGrid && (
        <>
          {Array.from({ length: cols - 1 }, (_, i) => (
            <div
              key={`gc-${i}`}
              className="absolute top-0 bottom-0 border-l border-border/30"
              style={{ left: (i + 1) * scaleX }}
            />
          ))}
          {Array.from({ length: Math.min(maxRow - 1, 30) }, (_, i) => (
            <div
              key={`gr-${i}`}
              className="absolute left-0 right-0 border-t border-border/30"
              style={{ top: (i + 1) * scaleY }}
            />
          ))}
        </>
      )}

      {/* Widget rectangles */}
      {widgets.map(w => {
        const color = WIDGET_COLORS[w.i] || '#6B7280';
        const isHighlighted = highlightWidget === w.i;
        return (
          <div
            key={w.i}
            className="absolute rounded-[2px] flex items-center justify-center transition-all"
            style={{
              left: w.x * scaleX + 0.5,
              top: w.y * scaleY + 0.5,
              width: w.w * scaleX - 1,
              height: w.h * scaleY - 1,
              backgroundColor: `${color}${isHighlighted ? 'cc' : '80'}`,
              border: isHighlighted ? `2px solid ${color}` : `1px solid ${color}99`,
            }}
            title={w.i}
          >
            {showLabels && w.w * scaleX > 16 && w.h * scaleY > 10 && (
              <span
                className="text-white font-bold leading-none select-none"
                style={{ fontSize: Math.min(9, Math.min(w.w * scaleX, w.h * scaleY) * 0.35) }}
              >
                {WIDGET_LABELS[w.i] || w.i.slice(0, 3).toUpperCase()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { WIDGET_COLORS, WIDGET_LABELS };
