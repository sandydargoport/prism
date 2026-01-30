'use client';

import * as React from 'react';
import { useMemo, useRef } from 'react';
import { ResponsiveGridLayout as RGL, useContainerWidth } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface GridLayoutProps {
  layout: WidgetConfig[];
  isEditable: boolean;
  widgetProps: Record<string, Record<string, unknown>>;
  onLayoutChange?: (layout: WidgetConfig[]) => void;
  className?: string;
}

class WidgetBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, background: '#300', color: '#f88', fontSize: 12, overflow: 'auto' }}>
          <strong>{this.props.name} crashed:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function GridLayout({
  layout,
  isEditable,
  widgetProps,
  onLayoutChange,
  className,
}: GridLayoutProps) {
  const { width, containerRef, mounted } = useContainerWidth();

  // Stabilize layout reference to prevent re-render loops
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
    [stableLayout]
  );

  const visibleWidgets = useMemo(
    () => stableLayout.filter(w => w.visible !== false),
    [stableLayout]
  );

  const handleLayoutChange = useMemo(() => {
    if (!onLayoutChange) return undefined;
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

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={className} style={{ minHeight: '100%' }}>
      {mounted && width > 0 ? (
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
          {visibleWidgets.map(w => {
            const reg = WIDGET_REGISTRY[w.i];
            if (!reg) {
              return (
                <div key={w.i} style={{ background: '#330', color: '#ff0', padding: 8 }}>
                  Unknown widget: {w.i}
                </div>
              );
            }
            const Component = reg.component;
            const props = widgetProps[w.i] || {};
            return (
              <div key={w.i} className="relative">
                {isEditable && (
                  <div className="absolute inset-0 z-10 border-2 border-dashed border-primary/40 rounded-lg pointer-events-none" />
                )}
                <div className="h-full w-full overflow-hidden">
                  <WidgetBoundary name={w.i}>
                    <Component {...props} />
                  </WidgetBoundary>
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
  );
}
