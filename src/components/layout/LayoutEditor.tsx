'use client';

import * as React from 'react';
import { useState } from 'react';
import { WidgetPicker } from './WidgetPicker';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface LayoutEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  onSave: (name?: string) => void;
  onSaveAs: () => void;
  onReset: () => void;
  onCancel: () => void;
  layoutName?: string;
}

export function LayoutEditor({
  widgets,
  onWidgetsChange,
  onSave,
  onSaveAs,
  onReset,
  onCancel,
  layoutName,
}: LayoutEditorProps) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const handleToggleWidget = (widgetType: string, visible: boolean) => {
    const exists = widgets.find(w => w.i === widgetType);
    if (exists) {
      onWidgetsChange(
        widgets.map(w =>
          w.i === widgetType ? { ...w, visible } : w
        )
      );
    } else if (visible) {
      const reg = WIDGET_REGISTRY[widgetType];
      if (!reg) return;
      // Find next available position
      const maxY = Math.max(0, ...widgets.map(w => w.y + w.h));
      onWidgetsChange([
        ...widgets,
        {
          i: widgetType,
          x: 0,
          y: maxY,
          w: reg.defaultW,
          h: reg.defaultH,
          visible: true,
        },
      ]);
    }
  };

  const handleSelectTemplate = (templateKey: string) => {
    const template = LAYOUT_TEMPLATES[templateKey];
    if (template) {
      onWidgetsChange(template.widgets.map(w => ({ ...w, visible: true })));
    }
    setShowTemplatePicker(false);
  };

  return (
    <div className="bg-card border-b border-border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EditIcon />
          <span className="text-sm font-medium">
            Editing: {layoutName || 'Untitled Layout'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
            className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Templates
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onSaveAs}
            className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Save As
          </button>
          <button
            onClick={() => onSave()}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Widget visibility toggles */}
      <WidgetPicker widgets={widgets} onToggle={handleToggleWidget} />

      {/* Template selector dropdown */}
      {showTemplatePicker && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {Object.entries(LAYOUT_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => handleSelectTemplate(key)}
              className="px-3 py-2 rounded-md bg-muted hover:bg-accent transition-colors text-left"
            >
              <div className="text-sm font-medium">{template.name}</div>
              <div className="text-xs text-muted-foreground">{template.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
