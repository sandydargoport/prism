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
  screenGuideOrientation: 'landscape' | 'portrait';
  effectiveEnabledSizes: string[];
  onToggleSize?: (size: string) => void;
  allSizeNames: string[];
  zones: ScreenSafeZones;
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
  screenGuideOrientation,
  effectiveEnabledSizes,
  onToggleSize,
  allSizeNames,
  zones,
  validation,
}: LayoutEditorPreviewPanelProps) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2 items-start">
        <LayoutPreview
          widgets={visibleWidgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h }))}
          width={200}
          height={200}
          highlightWidget={focusedWidget}
          showLabels={true}
          showGrid={true}
          visibleRows={gridVisibleRows}
          scrollY={gridScrollY}
          visibleCols={gridVisibleCols}
          scrollX={gridScrollX}
          onScrollTo={(row, col) => scrollToGridRef?.current?.(row, col)}
          screenGuideOrientation={screenGuideOrientation}
          enabledSizes={effectiveEnabledSizes}
          safeZones={zones}
        />
        <div className="flex flex-col gap-1">
          {allSizeNames.map(size => {
            const zone = zones[screenGuideOrientation].find(z => z.name === size);
            const isEnabled = effectiveEnabledSizes.includes(size);
            return (
              <button
                key={size}
                onClick={() => onToggleSize?.(size)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                  isEnabled ? 'text-white' : 'text-muted-foreground/50 line-through'
                }`}
                style={{
                  backgroundColor: isEnabled ? zone?.color : 'transparent',
                  border: `1px solid ${zone?.color || '#666'}`,
                }}
              >
                {size}
              </button>
            );
          })}
          <span className="text-[9px] text-muted-foreground mt-1 leading-tight">
            Click map<br />to scroll
          </span>
        </div>
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
