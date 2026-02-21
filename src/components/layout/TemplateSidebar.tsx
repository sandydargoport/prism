'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { SCREENSAVER_TEMPLATES } from '@/lib/constants/screensaverTemplates';
import type { SavedLayout } from './LayoutEditor';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

interface TemplateSidebarProps {
  editingScreensaver: boolean;
  orientation?: 'landscape' | 'portrait';
  savedLayouts: SavedLayout[];
  screensaverPresets: Array<{ name: string; widgets: WidgetConfig[] }>;
  onSelectTemplate: (templateKey: string) => void;
  onSelectSavedLayout: (layout: SavedLayout) => void;
  onSelectSsTemplate: (templateKey: string) => void;
  onSelectSsPreset: (preset: { name: string; widgets: WidgetConfig[] }) => void;
  onDeleteLayout?: (id: string) => void;
  onDeleteScreensaverPreset?: (name: string) => void;
  onToggleCommunity: () => void;
}

export function TemplateSidebar({
  editingScreensaver,
  orientation = 'landscape',
  savedLayouts,
  screensaverPresets,
  onSelectTemplate,
  onSelectSavedLayout,
  onSelectSsTemplate,
  onSelectSsPreset,
  onDeleteLayout,
  onDeleteScreensaverPreset,
  onToggleCommunity,
}: TemplateSidebarProps) {
  const allTemplates = editingScreensaver ? SCREENSAVER_TEMPLATES : LAYOUT_TEMPLATES;
  const templates = Object.fromEntries(
    Object.entries(allTemplates).filter(([, t]) => t.orientation === orientation)
  );
  const [savedOpen, setSavedOpen] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);

  // Close saved dropdown on outside click
  useEffect(() => {
    if (!savedOpen) return;
    const handler = (e: MouseEvent) => {
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) {
        setSavedOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [savedOpen]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (!key) return;
    if (editingScreensaver) {
      onSelectSsTemplate(key);
    } else {
      onSelectTemplate(key);
    }
    e.target.value = '';
  };

  const savedItems = editingScreensaver ? screensaverPresets : savedLayouts;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Built-in templates dropdown */}
      <select
        onChange={handleTemplateChange}
        defaultValue=""
        className="px-2 py-1.5 text-xs bg-muted border border-border rounded-md cursor-pointer hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="" disabled>Templates...</option>
        {Object.entries(templates).map(([key, template]) => (
          <option key={key} value={key}>{template.name}</option>
        ))}
      </select>

      {/* Saved layouts dropdown (custom, to support delete buttons) */}
      <div className="relative" ref={savedRef}>
        <button
          onClick={() => setSavedOpen(prev => !prev)}
          className="px-2 py-1.5 text-xs bg-muted border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-1"
        >
          Saved{savedItems.length > 0 ? ` (${savedItems.length})` : ''}
          <ChevronIcon open={savedOpen} />
        </button>
        {savedOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-popover border border-border rounded-md shadow-md py-1">
            {savedItems.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">No saved layouts</div>
            )}
            {editingScreensaver
              ? screensaverPresets.map(preset => (
                  <div key={preset.name} className="group flex items-center hover:bg-accent">
                    <button
                      onClick={() => { onSelectSsPreset(preset); setSavedOpen(false); }}
                      className="flex-1 text-left px-3 py-1.5 text-xs truncate"
                      title={`${preset.widgets.filter(w => w.visible !== false).length} widgets`}
                    >
                      {preset.name}
                    </button>
                    {onDeleteScreensaverPreset && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete preset "${preset.name}"?`)) {
                            onDeleteScreensaverPreset(preset.name);
                          }
                        }}
                        className="p-1 mr-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                        title="Delete preset"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))
              : savedLayouts.map(layout => (
                  <div key={layout.id} className="group flex items-center hover:bg-accent">
                    <button
                      onClick={() => { onSelectSavedLayout(layout); setSavedOpen(false); }}
                      className="flex-1 text-left px-3 py-1.5 text-xs truncate"
                      title={`${layout.widgets.length} widgets`}
                    >
                      {layout.name}
                    </button>
                    {onDeleteLayout && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete layout "${layout.name}"?`)) {
                            onDeleteLayout(layout.id);
                          }
                        }}
                        className="p-1 mr-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                        title="Delete layout"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))
            }
          </div>
        )}
      </div>

      {/* Browse Community link */}
      <button
        onClick={onToggleCommunity}
        className="px-2 py-1.5 text-xs text-primary hover:text-primary/80 hover:bg-accent rounded-md transition-colors"
      >
        Browse Community...
      </button>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
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
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}
