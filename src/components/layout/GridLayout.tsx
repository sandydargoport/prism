'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { ResponsiveGridLayout as RGL, useContainerWidth } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import 'react-grid-layout/css/styles.css';

export interface GridLayoutProps {
  layout: WidgetConfig[];
  isEditable: boolean;
  widgetProps: Record<string, Record<string, unknown>>;
  onLayoutChange?: (layout: WidgetConfig[]) => void;
  className?: string;
}

export function GridLayout({
  layout,
  isEditable,
  widgetProps,
  onLayoutChange,
  className,
}: GridLayoutProps) {
  const { width, containerRef } = useContainerWidth();

  const rglLayout: LayoutItem[] = useMemo(
    () =>
      layout
        .filter(w => w.visible !== false)
        .map(w => {
          const reg = WIDGET_REGISTRY[w.i];
          return {
            i: w.i,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            minW: reg?.minW ?? 1,
            minH: reg?.minH ?? 1,
          };
        }),
    [layout]
  );

  const handleLayoutChange = (newLayout: Layout) => {
    if (!onLayoutChange) return;
    const updated: WidgetConfig[] = layout.map(w => {
      const found = newLayout.find((l: LayoutItem) => l.i === w.i);
      if (found) {
        return { ...w, x: found.x, y: found.y, w: found.w, h: found.h };
      }
      return w;
    });
    onLayoutChange(updated);
  };

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={className}>
      <RGL
        className="layout"
        width={width}
        layouts={{ lg: rglLayout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 4, md: 3, sm: 2, xs: 1 }}
        rowHeight={200}
        dragConfig={{ enabled: isEditable }}
        resizeConfig={{ enabled: isEditable }}
        onLayoutChange={handleLayoutChange}
        containerPadding={[16, 16]}
        margin={[16, 16]}
      >
        {layout
          .filter(w => w.visible !== false)
          .map(w => {
            const reg = WIDGET_REGISTRY[w.i];
            if (!reg) return null;
            const Component = reg.component;
            const props = widgetProps[w.i] || {};
            return (
              <div key={w.i} className="relative">
                {isEditable && (
                  <div className="absolute inset-0 z-10 border-2 border-dashed border-primary/40 rounded-lg pointer-events-none" />
                )}
                <div className="h-full w-full overflow-hidden">
                  <Component {...props} />
                </div>
              </div>
            );
          })}
      </RGL>
    </div>
  );
}
