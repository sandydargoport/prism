'use client';

import * as React from 'react';
import { LayoutPreview } from './LayoutPreview';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { ScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';

interface LayoutEditorPreviewPanelProps {
  visibleWidgets: WidgetConfig[];
  focusedWidget?: string;
  gridScrollY: number;
  gridVisibleRows: number;
  gridScrollX: number;
  gridVisibleCols: number;
  scrollToGridRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
  // Retained for compatibility with the toolbar caller; the multi-screen
  // safe-zone toggles/borders were retired in favor of the device gallery, so
  // these are no longer used here.
  screenGuideOrientation?: 'landscape' | 'portrait';
  effectiveEnabledSizes?: string[];
  onToggleSize?: (size: string) => void;
  allSizeNames?: string[];
  zones?: ScreenSafeZones;
  validation: { errors: string[]; warnings: string[] };
}

export function LayoutEditorPreviewPanel({
  visibleWidgets,
  focusedWidget,
  gridScrollY,
  gridVisibleRows,
  gridScrollX,
  gridVisibleCols,
  scrollToGridRef,
  validation,
}: LayoutEditorPreviewPanelProps) {
  const previewWidgets = visibleWidgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h }));

  return (
    <div className="p-3 space-y-3">
      {/* INTERACTIVE canvas mini-map — the one real, scrollable canvas. */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-3xs font-medium text-muted-foreground uppercase tracking-wide">Canvas</p>
          <span className="text-4xs text-muted-foreground/70">click to scroll</span>
        </div>
        <LayoutPreview
          widgets={previewWidgets}
          width={280}
          height={180}
          highlightWidget={focusedWidget}
          showLabels={true}
          showGrid={true}
          visibleRows={gridVisibleRows}
          scrollY={gridScrollY}
          visibleCols={gridVisibleCols}
          scrollX={gridScrollX}
          onScrollTo={(row, col) => scrollToGridRef?.current?.(row, col)}
        />
      </div>

      {/* No per-device thumbnails (#1324): the dashboard stretches to fill its
          screen, so they all looked alike. Shown at, on the canvas, shows any
          screen's size full size. */}
      {validation.errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2">
          <p className="text-xs font-medium text-destructive mb-0.5">
            {validation.errors.length} issue{validation.errors.length > 1 ? 's' : ''}
          </p>
          {validation.errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive/80 leading-tight">{err}</p>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && validation.errors.length === 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-md p-2">
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-xs text-warning leading-tight">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
