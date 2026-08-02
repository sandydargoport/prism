'use client';

import * as React from 'react';
import { LayoutPreview } from './LayoutPreview';
import { DevicePreviewGallery } from './DevicePreviewGallery';
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
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Canvas</p>
          <span className="text-[9px] text-muted-foreground/70">click to scroll</span>
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

      {/* REFERENCE — how the one design looks on each screen. Not editable;
          delineated (bordered, muted background) so it reads as a preview. */}
      <div className="rounded-md border border-border/60 bg-muted/40 p-2">
        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
          Preview — each screen <span className="normal-case font-normal opacity-60">(reference)</span>
        </p>
        <DevicePreviewGallery widgets={previewWidgets} highlightWidget={focusedWidget} />
      </div>

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
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 leading-tight">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
