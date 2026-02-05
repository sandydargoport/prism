'use client';

import * as React from 'react';
import { WIDGET_REGISTRY, ALL_WIDGET_TYPES } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface WidgetPickerProps {
  widgets: WidgetConfig[];
  onToggle: (widgetType: string, visible: boolean) => void;
  widgetList?: Array<{ id: string; label: string }>;
}

export function WidgetPicker({ widgets, onToggle, widgetList }: WidgetPickerProps) {
  const visibleSet = new Set(
    widgets.filter(w => w.visible !== false).map(w => w.i)
  );

  const items = widgetList
    ? widgetList.map(w => ({ type: w.id, label: w.label }))
    : ALL_WIDGET_TYPES.map(type => {
        const reg = WIDGET_REGISTRY[type];
        return reg ? { type, label: reg.label } : null;
      }).filter(Boolean) as Array<{ type: string; label: string }>;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ type, label }) => {
        const isVisible = visibleSet.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type, !isVisible)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isVisible
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
