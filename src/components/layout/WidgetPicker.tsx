'use client';

import * as React from 'react';
import { WIDGET_REGISTRY, ALL_WIDGET_TYPES } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface WidgetPickerProps {
  widgets: WidgetConfig[];
  onToggle: (widgetType: string, visible: boolean) => void;
}

export function WidgetPicker({ widgets, onToggle }: WidgetPickerProps) {
  const visibleSet = new Set(
    widgets.filter(w => w.visible !== false).map(w => w.i)
  );

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_WIDGET_TYPES.map(type => {
        const reg = WIDGET_REGISTRY[type];
        if (!reg) return null;
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
            {reg.label}
          </button>
        );
      })}
    </div>
  );
}
