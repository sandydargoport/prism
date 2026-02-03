'use client';

import * as React from 'react';
import { useState } from 'react';
import { WidgetPicker } from './WidgetPicker';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export interface SavedLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

export interface LayoutEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  onSave: (name?: string) => void;
  onSaveAs: () => void;
  onReset: () => void;
  onCancel: () => void;
  onDeleteLayout?: (id: string) => void;
  layoutName?: string;
  savedLayouts?: SavedLayout[];
  editingScreensaver?: boolean;
  onToggleScreensaverEdit?: () => void;
}

export function LayoutEditor({
  widgets,
  onWidgetsChange,
  onSave,
  onSaveAs,
  onReset,
  onCancel,
  onDeleteLayout,
  layoutName,
  savedLayouts = [],
  editingScreensaver = false,
  onToggleScreensaverEdit,
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

  const handleSelectSavedLayout = (layout: SavedLayout) => {
    onWidgetsChange(layout.widgets.map(w => ({ ...w, visible: w.visible !== false })));
    setShowTemplatePicker(false);
  };

  return (
    <div className="bg-card/85 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EditIcon />
          <span className="text-sm font-medium">
            Editing: {layoutName || 'Untitled Layout'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleScreensaverEdit && (
            <button
              onClick={onToggleScreensaverEdit}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                editingScreensaver
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted hover:bg-accent'
              }`}
            >
              {editingScreensaver ? '← Dashboard' : 'Screensaver'}
            </button>
          )}
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
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Built-in Templates</div>
            <div className="flex flex-wrap gap-2">
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
          </div>
          {savedLayouts.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Saved Layouts</div>
              <div className="flex flex-wrap gap-2">
                {savedLayouts.map(layout => (
                  <div key={layout.id} className="flex items-center gap-1">
                    <button
                      onClick={() => handleSelectSavedLayout(layout)}
                      className="px-3 py-2 rounded-md bg-muted hover:bg-accent transition-colors text-left"
                    >
                      <div className="text-sm font-medium">{layout.name}</div>
                      <div className="text-xs text-muted-foreground">{layout.widgets.length} widgets</div>
                    </button>
                    {onDeleteLayout && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete layout "${layout.name}"?`)) {
                            onDeleteLayout(layout.id);
                          }
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete layout"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
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
