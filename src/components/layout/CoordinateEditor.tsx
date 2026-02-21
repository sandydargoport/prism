'use client';

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { WIDGET_COLORS } from './LayoutPreview';
import { WIDGET_REGISTRY, ALL_WIDGET_TYPES, SCREENSAVER_WIDGETS } from '@/components/widgets/widgetRegistry';
import { validateCommunityLayout } from '@/lib/community/validateLayout';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface CoordinateEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  mode: 'dashboard' | 'screensaver';
  onFocusedWidgetChange?: (widgetId: string | null) => void;
}

export function CoordinateEditor({ widgets, onWidgetsChange, mode, onFocusedWidgetChange }: CoordinateEditorProps) {
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);

  const handleFocusChange = useCallback((widgetId: string | null) => {
    setFocusedWidget(widgetId);
    onFocusedWidgetChange?.(widgetId);
  }, [onFocusedWidgetChange]);

  const availableWidgets = mode === 'screensaver'
    ? SCREENSAVER_WIDGETS.map(w => w.id)
    : ALL_WIDGET_TYPES;

  // Validation for real-time feedback
  const validation = useMemo(() => {
    const layoutData = {
      type: 'prism-layout' as const,
      version: 2,
      mode,
      name: '',
      description: '',
      author: '',
      tags: [],
      screenSizes: [],
      orientation: 'landscape' as const,
      widgets: widgets.filter(w => w.visible !== false),
    };
    return validateCommunityLayout(layoutData);
  }, [widgets, mode]);

  // Per-widget errors
  const widgetErrors = useMemo(() => {
    const errors: Record<string, string[]> = {};
    for (const err of validation.errors) {
      // Match errors like 'Widget "clock": ...'
      const match = err.match(/Widget "(\w+)":/);
      if (match?.[1]) {
        const id = match[1];
        if (!errors[id]) errors[id] = [];
        errors[id]!.push(err);
      }
      // Match overlap errors like 'Widgets "clock" and "weather" overlap'
      const overlapMatch = err.match(/Widgets "(\w+)" and "(\w+)" overlap/);
      if (overlapMatch?.[1] && overlapMatch[2]) {
        for (const id of [overlapMatch[1], overlapMatch[2]]) {
          if (!errors[id]) errors[id] = [];
          errors[id]!.push(err);
        }
      }
    }
    return errors;
  }, [validation.errors]);

  const handleToggleVisible = useCallback((widgetId: string, visible: boolean) => {
    const exists = widgets.find(w => w.i === widgetId);
    if (exists) {
      onWidgetsChange(widgets.map(w =>
        w.i === widgetId ? { ...w, visible } : w
      ));
    } else if (visible) {
      const reg = WIDGET_REGISTRY[widgetId];
      if (!reg) return;
      const maxY = Math.max(0, ...widgets.filter(w => w.visible !== false).map(w => w.y + w.h));
      onWidgetsChange([
        ...widgets,
        {
          i: widgetId,
          x: 0,
          y: maxY,
          w: reg.defaultW,
          h: reg.defaultH,
          visible: true,
        },
      ]);
    }
  }, [widgets, onWidgetsChange]);

  const handleUpdateWidget = useCallback((widgetId: string, field: 'x' | 'y' | 'w' | 'h', value: number) => {
    onWidgetsChange(widgets.map(w =>
      w.i === widgetId ? { ...w, [field]: value } : w
    ));
  }, [widgets, onWidgetsChange]);

  // Split widgets into two columns for compact layout
  const midpoint = Math.ceil(availableWidgets.length / 2);
  const leftWidgets = availableWidgets.slice(0, midpoint);
  const rightWidgets = availableWidgets.slice(midpoint);

  const renderWidgetTable = (widgetIds: string[]) => (
    <table className="text-sm flex-1">
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
        {widgetIds.map(widgetId => {
          const widget = widgets.find(w => w.i === widgetId);
          const isVisible = widget?.visible !== false && !!widget;
          const reg = WIDGET_REGISTRY[widgetId];
          const color = WIDGET_COLORS[widgetId] || '#6B7280';
          const errors = widgetErrors[widgetId];
          const isFocused = focusedWidget === widgetId;

          return (
            <React.Fragment key={widgetId}>
              <tr
                className={`border-b border-border/50 transition-colors ${
                  isFocused ? 'bg-primary/5' : ''
                } ${errors ? 'bg-destructive/5' : ''}`}
              >
                <td className="py-1 px-1">
                  <button
                    onClick={() => handleToggleVisible(widgetId, !isVisible)}
                    className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                      isVisible ? 'text-white' : 'text-muted-foreground/50 line-through'
                    }`}
                    style={{
                      backgroundColor: isVisible ? color : 'transparent',
                      border: `1px solid ${color}`,
                    }}
                  >
                    {reg?.label || widgetId}
                  </button>
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget?.x ?? 0}
                    min={0}
                    max={11}
                    disabled={!isVisible}
                    hasError={!!errors}
                    onChange={v => handleUpdateWidget(widgetId, 'x', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget?.y ?? 0}
                    min={0}
                    max={29}
                    disabled={!isVisible}
                    hasError={!!errors}
                    onChange={v => handleUpdateWidget(widgetId, 'y', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget?.w ?? reg?.defaultW ?? 3}
                    min={reg?.minW ?? 1}
                    max={12}
                    disabled={!isVisible}
                    hasError={!!errors}
                    onChange={v => handleUpdateWidget(widgetId, 'w', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
                <td className="py-1 px-0.5">
                  <CoordInput
                    value={widget?.h ?? reg?.defaultH ?? 3}
                    min={reg?.minH ?? 1}
                    max={30}
                    disabled={!isVisible}
                    hasError={!!errors}
                    onChange={v => handleUpdateWidget(widgetId, 'h', v)}
                    onFocus={() => handleFocusChange(widgetId)}
                    onBlur={() => handleFocusChange(null)}
                  />
                </td>
              </tr>
              {errors && isVisible && (
                <tr>
                  <td colSpan={5} className="px-2 pb-1">
                    {errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="flex gap-2">
      {renderWidgetTable(leftWidgets)}
      {renderWidgetTable(rightWidgets)}
    </div>
  );
}

function CoordInput({
  value,
  min,
  max,
  disabled,
  hasError,
  onChange,
  onFocus,
  onBlur,
}: {
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  hasError: boolean;
  onChange: (v: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <input
      type="number"
      value={disabled ? '' : value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={e => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`w-full text-center text-sm px-1 py-0.5 rounded border transition-colors
        ${disabled
          ? 'bg-muted/50 text-muted-foreground/50 border-border/50 cursor-not-allowed'
          : hasError
            ? 'bg-muted border-destructive/50 text-foreground focus:outline-none focus:ring-1 focus:ring-destructive'
            : 'bg-muted border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary'
        }`}
    />
  );
}
