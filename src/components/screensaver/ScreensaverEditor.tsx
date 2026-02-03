'use client';

import * as React from 'react';
import { useState, useCallback, useMemo, useRef } from 'react';
import { ResponsiveGridLayout as RGL, useContainerWidth, noCompactor } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import { saveScreensaverLayout } from './Screensaver';
import { isLightColor } from '@/lib/utils/color';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const SCREENSAVER_LAYOUT_KEY = 'prism-screensaver-layout';

const ssColorOptions = [
  null,
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#FFFFFF', '#9CA3AF', '#6B7280', '#374151', '#000000',
];

interface ScreensaverWidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
}

const defaultLayout: ScreensaverWidgetLayout[] = [
  { i: 'clock', x: 8, y: 9, w: 4, h: 3 },
  { i: 'weather', x: 8, y: 7, w: 4, h: 2 },
  { i: 'messages', x: 8, y: 4, w: 4, h: 3 },
];

function loadLayout(): ScreensaverWidgetLayout[] {
  if (typeof window === 'undefined') return defaultLayout;
  try {
    const stored = localStorage.getItem(SCREENSAVER_LAYOUT_KEY);
    return stored ? JSON.parse(stored) : defaultLayout;
  } catch { return defaultLayout; }
}

/** Color picker button with triple-ring for visibility on any background */
function SSColorPickerButton({ bgColor, onClick }: { bgColor?: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full shadow-md"
      style={{
        backgroundColor: bgColor || 'transparent',
        boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 0 0 4px rgba(255,255,255,0.8), 0 0 0 5px rgba(0,0,0,0.3)',
      }}
      title="Widget settings"
    />
  );
}

export function ScreensaverEditor() {
  const [layout, setLayout] = useState<ScreensaverWidgetLayout[]>(loadLayout);
  const { width, containerRef, mounted } = useContainerWidth();
  const [colorPickerWidget, setColorPickerWidget] = useState<string | null>(null);

  const rowHeight = useMemo(() => {
    if (typeof window === 'undefined') return 60;
    return Math.max(30, Math.floor((window.innerHeight - 200) / 12));
  }, []);

  const rglLayout: LayoutItem[] = useMemo(
    () => layout.map((w) => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 1 })),
    [layout]
  );

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    const updated = layoutRef.current.map((w) => {
      const found = newLayout.find((l: LayoutItem) => l.i === w.i);
      if (found) return { ...w, x: found.x, y: found.y, w: found.w, h: found.h };
      return w;
    });
    setLayout(updated);
    saveScreensaverLayout(updated);
  }, []);

  const updateWidget = useCallback((widgetId: string, updates: Partial<ScreensaverWidgetLayout>) => {
    const updated = layoutRef.current.map(w =>
      w.i === widgetId ? { ...w, ...updates } : w
    );
    setLayout(updated);
    saveScreensaverLayout(updated);
  }, []);

  const renderWidgetPanel = (widgetId: string) => {
    const w = layout.find(l => l.i === widgetId);
    if (!w) return null;
    const bgColor = w.backgroundColor;
    const bgOpacity = w.backgroundOpacity ?? 1;

    const isOpen = colorPickerWidget === widgetId;
    return (
      <div className="absolute top-1 left-1 z-20" onMouseLeave={() => { if (isOpen) setColorPickerWidget(null); }}>
        <SSColorPickerButton
          bgColor={bgColor}
          onClick={(e) => { e.stopPropagation(); setColorPickerWidget(isOpen ? null : widgetId); }}
        />
        {isOpen && (
          <div className="absolute top-8 left-0 bg-card border border-border rounded-lg p-2 shadow-xl z-30 w-[180px] space-y-2" onClick={(e) => e.stopPropagation()}>
            {/* Color swatches */}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Color</div>
              <div className="grid grid-cols-4 gap-1">
              {ssColorOptions.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => updateWidget(widgetId, { backgroundColor: c ?? undefined })}
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                    c === null ? 'bg-gradient-to-br from-white to-gray-400 border-gray-300' : 'border-gray-400'
                  } ${bgColor === c || (!bgColor && c === null) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={c ? { backgroundColor: c } : undefined}
                  title={c === null ? 'None' : c}
                />
              ))}
              </div>
            </div>
            {/* Opacity */}
            <div className="border-t border-border pt-1.5">
              <div className="text-[10px] text-muted-foreground mb-1">Opacity</div>
              <div className="flex gap-1">
                {[1, 0.75, 0.5, 0.25].map((o) => (
                  <button
                    key={o}
                    onClick={() => updateWidget(widgetId, { backgroundOpacity: o })}
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

  const getWidgetStyle = (widgetId: string) => {
    const w = layout.find(l => l.i === widgetId);
    if (!w?.backgroundColor) return undefined;
    return { backgroundColor: w.backgroundColor, borderRadius: '0.5rem', opacity: w.backgroundOpacity ?? 1 };
  };

  const getTextClass = (widgetId: string, fallback: string) => {
    const w = layout.find(l => l.i === widgetId);
    if (!w?.backgroundColor) return fallback;
    return isLightColor(w.backgroundColor) ? 'text-black' : 'text-white';
  };

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="relative bg-black/80 rounded-lg mx-4 my-2"
      style={{ minHeight: rowHeight * 12 + 24 }}
    >
      <div className="absolute top-2 left-4 text-white/50 text-xs z-20">
        Screensaver Layout — Drag widgets to reposition
      </div>
      {mounted && width > 0 && (
        <RGL
          className="layout"
          width={width}
          layouts={{ lg: rglLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 9, sm: 6, xs: 3 }}
          rowHeight={rowHeight}
          compactor={noCompactor}
          dragConfig={{ enabled: true }}
          resizeConfig={{ enabled: true, handles: ['n', 's', 'e', 'w', 'ne', 'se', 'sw'] }}
          onLayoutChange={handleLayoutChange}
          containerPadding={[12, 12]}
          margin={[4, 4]}
        >
          <div key="clock" className={`relative ${colorPickerWidget === 'clock' ? 'z-[100]' : ''}`} style={getWidgetStyle('clock')}>
            <div className="absolute inset-0 z-10 border-2 border-dashed border-white/40 rounded-lg pointer-events-none" />
            {renderWidgetPanel('clock')}
            <div className={`h-full flex flex-col justify-end text-right p-3 ${getTextClass('clock', 'text-white')}`}>
              <div className="text-4xl font-light tabular-nums">12:00 <span className="text-lg opacity-70">PM</span></div>
              <div className="text-sm mt-1 text-white/60">Saturday, February 1</div>
            </div>
          </div>
          <div key="weather" className={`relative ${colorPickerWidget === 'weather' ? 'z-[100]' : ''}`} style={getWidgetStyle('weather')}>
            <div className="absolute inset-0 z-10 border-2 border-dashed border-white/40 rounded-lg pointer-events-none" />
            {renderWidgetPanel('weather')}
            <div className={`h-full flex items-center justify-end p-3 ${getTextClass('weather', 'text-white/80')}`}>
              <div className="text-2xl font-light">72°F</div>
              <div className="text-sm text-white/50 ml-2">Sunny</div>
            </div>
          </div>
          <div key="messages" className={`relative ${colorPickerWidget === 'messages' ? 'z-[100]' : ''}`} style={getWidgetStyle('messages')}>
            <div className="absolute inset-0 z-10 border-2 border-dashed border-white/40 rounded-lg pointer-events-none" />
            {renderWidgetPanel('messages')}
            <div className={`h-full flex flex-col justify-end text-right p-3 ${getTextClass('messages', 'text-white/80')}`}>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Family Messages</div>
              <p className="text-sm text-white/70">Sample message text...</p>
              <p className="text-xs text-white/40 mt-0.5">— Family</p>
            </div>
          </div>
        </RGL>
      )}
    </div>
  );
}
