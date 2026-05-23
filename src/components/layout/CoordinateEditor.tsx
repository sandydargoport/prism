'use client';

import * as React from 'react';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WIDGET_COLORS } from './LayoutPreview';
import { WIDGET_REGISTRY, ALL_WIDGET_TYPES, SCREENSAVER_WIDGETS } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { findNextFreeSlot } from '@/lib/utils/widgetPlacement';

interface CoordinateEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  mode: 'dashboard' | 'screensaver';
  onFocusedWidgetChange?: (widgetId: string | null) => void;
}

export function CoordinateEditor({ widgets, onWidgetsChange, mode, onFocusedWidgetChange }: CoordinateEditorProps) {
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const handleFocusChange = useCallback((widgetId: string | null) => {
    setFocusedWidget(widgetId);
    onFocusedWidgetChange?.(widgetId);
  }, [onFocusedWidgetChange]);

  const allWidgetIds = mode === 'screensaver'
    ? SCREENSAVER_WIDGETS.map(w => w.id)
    : ALL_WIDGET_TYPES;

  // Split into visible and hidden, both sorted alphabetically by label so
  // the "Add widget" picker and the "currently visible" table follow the
  // same ordering. Previously `visibleIds` followed WIDGET_REGISTRY's
  // insertion order, which put newer widgets (Birthdays, Bus Tracker) at
  // arbitrary positions that didn't match the alpha-sorted hidden list.
  const byLabel = (a: string, b: string) => {
    const aLabel = WIDGET_REGISTRY[a]?.label || a;
    const bLabel = WIDGET_REGISTRY[b]?.label || b;
    return aLabel.localeCompare(bLabel);
  };

  const visibleIds = useMemo(() =>
    allWidgetIds
      .filter(id => {
        const w = widgets.find(w => w.i === id);
        return w && w.visible !== false;
      })
      .sort(byLabel),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allWidgetIds, widgets]);

  const hiddenIds = useMemo(() =>
    allWidgetIds
      .filter(id => !visibleIds.includes(id))
      .sort(byLabel),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allWidgetIds, visibleIds]);

  // Close add dropdown on outside click
  useEffect(() => {
    if (!addOpen) return;
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addOpen]);

  const handleAddWidget = useCallback((widgetId: string) => {
    const exists = widgets.find(w => w.i === widgetId);
    if (exists) {
      onWidgetsChange(widgets.map(w =>
        w.i === widgetId ? { ...w, visible: true } : w
      ));
    } else {
      const reg = WIDGET_REGISTRY[widgetId];
      if (!reg) return;
      // Find the first free slot row-by-row, columns inside each row — slots
      // a new widget into top-row gaps before falling through to the bottom.
      const { x, y } = findNextFreeSlot(widgets, reg.defaultW, reg.defaultH);
      onWidgetsChange([
        ...widgets,
        { i: widgetId, x, y, w: reg.defaultW, h: reg.defaultH, visible: true },
      ]);
    }
  }, [widgets, onWidgetsChange]);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    onWidgetsChange(widgets.map(w =>
      w.i === widgetId ? { ...w, visible: false } : w
    ));
  }, [widgets, onWidgetsChange]);

  const handleUpdateWidget = useCallback((widgetId: string, field: 'x' | 'y' | 'w' | 'h', value: number) => {
    onWidgetsChange(widgets.map(w =>
      w.i === widgetId ? { ...w, [field]: value } : w
    ));
  }, [widgets, onWidgetsChange]);

  return (
    <div className="space-y-1.5">
      <table className="text-xs w-full">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left py-1 px-1">Widget</th>
            <th className="text-center py-1 px-0.5 w-11">X</th>
            <th className="text-center py-1 px-0.5 w-11">Y</th>
            <th className="text-center py-1 px-0.5 w-11">W</th>
            <th className="text-center py-1 px-0.5 w-11">H</th>
          </tr>
        </thead>
        <tbody>
          {visibleIds.map(widgetId => {
            const widget = widgets.find(w => w.i === widgetId);
            if (!widget || widget.visible === false) return null;
            const reg = WIDGET_REGISTRY[widgetId];
            const color = WIDGET_COLORS[widgetId] || '#6B7280';
            const isFocused = focusedWidget === widgetId;

            return (
              <tr
                key={widgetId}
                className={`border-b border-border/50 transition-colors ${
                  isFocused ? 'bg-primary/5' : ''
                }`}
              >
                <td className="py-1 px-1">
                  <button
                    onClick={() => handleRemoveWidget(widgetId)}
                    className="w-full text-left text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap text-white"
                    style={{
                      backgroundColor: color,
                      border: `1px solid ${color}`,
                    }}
                    title="Click to hide"
                  >
                    {reg?.label || widgetId}
                  </button>
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget.x}
                    min={0}
                    max={47}
                    onChange={v => handleUpdateWidget(widgetId, 'x', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget.y}
                    min={0}
                    max={119}
                    onChange={v => handleUpdateWidget(widgetId, 'y', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget.w}
                    min={reg?.minW ?? 1}
                    max={48}
                    onChange={v => handleUpdateWidget(widgetId, 'w', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget.h}
                    min={reg?.minH ?? 1}
                    max={120}
                    onChange={v => handleUpdateWidget(widgetId, 'h', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Add widget dropdown */}
      {hiddenIds.length > 0 && (
        <div className="relative" ref={addRef}>
          <button
            onClick={() => setAddOpen(prev => !prev)}
            className="px-2 py-1 text-xs bg-muted border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-1"
          >
            + Add widget
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${addOpen ? '' : 'rotate-180'}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {addOpen && (
            <div className="mt-1 border border-border rounded-md py-1 max-h-[40vh] overflow-auto">
              {hiddenIds.map(id => {
                const reg = WIDGET_REGISTRY[id];
                const color = WIDGET_COLORS[id] || '#6B7280';
                return (
                  <button
                    key={id}
                    onClick={() => { handleAddWidget(id); }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {reg?.label || id}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoordInput({
  value,
  min,
  max,
  onChange,
  onFocus,
  onBlur,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={e => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      className="w-full text-center text-xs px-1 py-0.5 rounded border transition-colors bg-muted border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
