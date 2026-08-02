'use client';

import * as React from 'react';
import { WIDGET_COLORS } from './LayoutPreview';
import { DEVICE_PREVIEWS } from '@/lib/constants/devicePreviews';

interface PreviewWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DevicePreviewGalleryProps {
  widgets: PreviewWidget[];
  highlightWidget?: string;
  /** Longest edge of each device frame, in px. */
  frameMax?: number;
}

const DEFAULT_FRAME_MAX = 128;

/**
 * Shows the current layout rendered the way a handful of real devices would show
 * it. Because the live dashboard stretches its content to fill the screen, each
 * device frame stretches the design to that device's aspect (revealing the small
 * squish/stretch) when the orientation matches, and letterboxes it — centered,
 * true proportions — only on a genuine orientation mismatch. This mirrors
 * CssGridDisplay's live stretch-vs-contain decision, driven by content shape.
 */
export function DevicePreviewGallery({
  widgets,
  highlightWidget,
  frameMax = DEFAULT_FRAME_MAX,
}: DevicePreviewGalleryProps) {
  // Content bounding box (origin → furthest used cell) = the canvas that fills.
  let fitCols = 1;
  let fitRows = 1;
  for (const w of widgets) {
    if (w.x + w.w > fitCols) fitCols = w.x + w.w;
    if (w.y + w.h > fitRows) fitRows = w.y + w.h;
  }
  const contentWide = fitCols >= fitRows;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      {DEVICE_PREVIEWS.map(d => {
        const deviceWide = d.w >= d.h;
        const frameW = deviceWide ? frameMax : Math.round((frameMax * d.w) / d.h);
        const frameH = deviceWide ? Math.round((frameMax * d.h) / d.w) : frameMax;
        const match = contentWide === deviceWide;

        // match → stretch both axes to fill; mismatch → contain (square cells) + center.
        let cellW: number;
        let cellH: number;
        let offX = 0;
        let offY = 0;
        if (match) {
          cellW = frameW / fitCols;
          cellH = frameH / fitRows;
        } else {
          const cell = Math.min(frameW / fitCols, frameH / fitRows);
          cellW = cell;
          cellH = cell;
          offX = (frameW - fitCols * cell) / 2;
          offY = (frameH - fitRows * cell) / 2;
        }

        return (
          <div key={d.name} className="flex flex-col items-center gap-1">
            <div
              className="relative bg-muted/40 rounded-sm overflow-hidden ring-1 ring-border"
              style={{ width: frameW, height: frameH }}
            >
              {widgets.map(w => {
                const color = WIDGET_COLORS[w.i] || '#6B7280';
                const hi = highlightWidget === w.i;
                return (
                  <div
                    key={w.i}
                    className="absolute rounded-[1px]"
                    style={{
                      left: offX + w.x * cellW + 0.5,
                      top: offY + w.y * cellH + 0.5,
                      width: Math.max(1, w.w * cellW - 1),
                      height: Math.max(1, w.h * cellH - 1),
                      backgroundColor: `${color}${hi ? 'ee' : 'aa'}`,
                      outline: hi ? `1px solid ${color}` : undefined,
                    }}
                    title={w.i}
                  />
                );
              })}
              {!match && (
                <span className="absolute inset-x-0 bottom-0 text-center text-[7px] leading-tight text-muted-foreground bg-background/70">
                  letterboxed
                </span>
              )}
            </div>
            <span className="text-[9px] leading-none text-muted-foreground text-center">
              {d.name}
              {d.note && <span className="opacity-60"> · {d.note}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
