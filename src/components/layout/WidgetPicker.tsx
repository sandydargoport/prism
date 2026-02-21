'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { WIDGET_REGISTRY, ALL_WIDGET_TYPES } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface WidgetPickerProps {
  widgets: WidgetConfig[];
  onToggle: (widgetType: string, visible: boolean) => void;
  widgetList?: Array<{ id: string; label: string }>;
}

export function WidgetPicker({ widgets, onToggle, widgetList }: WidgetPickerProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const visibleSet = new Set(
    widgets.filter(w => w.visible !== false).map(w => w.i)
  );

  const items = widgetList
    ? widgetList.map(w => ({ type: w.id, label: w.label }))
    : ALL_WIDGET_TYPES.map(type => {
        const reg = WIDGET_REGISTRY[type];
        return reg ? { type, label: reg.label } : null;
      }).filter(Boolean) as Array<{ type: string; label: string }>;

  const visibleCount = items.filter(i => visibleSet.has(i.type)).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Position the portal panel below the button
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(prev => !prev)}
        className="px-2 py-1.5 text-xs bg-muted border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-1.5"
      >
        Widgets ({visibleCount}/{items.length})
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
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[9999] bg-popover border border-border rounded-md shadow-md py-1.5 px-1 min-w-[280px]"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="grid grid-cols-2 gap-x-2">
            {items.map(({ type, label }) => {
              const isVisible = visibleSet.has(type);
              return (
                <label
                  key={type}
                  className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggle(type, !isVisible)}
                    className="rounded"
                  />
                  <span className={`text-xs ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
