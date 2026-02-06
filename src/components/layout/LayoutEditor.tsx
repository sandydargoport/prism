'use client';

import * as React from 'react';
import { useState } from 'react';
import { WidgetPicker } from './WidgetPicker';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { SCREENSAVER_TEMPLATES } from '@/lib/constants/screensaverTemplates';
import { WIDGET_REGISTRY, SCREENSAVER_WIDGETS } from '@/components/widgets/widgetRegistry';
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
  screensaverWidgets?: WidgetConfig[];
  onScreensaverWidgetToggle?: (widgetType: string, visible: boolean) => void;
  onScreensaverSave?: () => void;
  onScreensaverSaveAs?: () => void;
  onScreensaverReset?: () => void;
  onSelectScreensaverTemplate?: (templateWidgets: WidgetConfig[]) => void;
  screensaverPresets?: Array<{ name: string; widgets: WidgetConfig[] }>;
  onSelectScreensaverPreset?: (widgets: WidgetConfig[]) => void;
  onDeleteScreensaverPreset?: (name: string) => void;
}

const EXPORT_VERSION = 1;

interface ExportWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  minW?: number;
  minH?: number;
}

interface LayoutExport {
  type: 'prism-layout';
  version: number;
  mode: 'dashboard' | 'screensaver';
  name: string;
  widgets: ExportWidget[];
}

function validateImport(data: unknown): LayoutExport | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.type !== 'prism-layout') return null;
  if (typeof obj.version !== 'number') return null;
  if (obj.mode !== 'dashboard' && obj.mode !== 'screensaver') return null;
  if (!Array.isArray(obj.widgets)) return null;
  for (const w of obj.widgets) {
    if (!w || typeof w !== 'object') return null;
    const wObj = w as Record<string, unknown>;
    if (typeof wObj.i !== 'string' || typeof wObj.x !== 'number' ||
        typeof wObj.y !== 'number' || typeof wObj.w !== 'number' ||
        typeof wObj.h !== 'number') return null;
  }
  return obj as unknown as LayoutExport;
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
  screensaverWidgets,
  onScreensaverWidgetToggle,
  onScreensaverSave,
  onScreensaverSaveAs,
  onScreensaverReset,
  onSelectScreensaverTemplate,
  screensaverPresets = [],
  onSelectScreensaverPreset,
  onDeleteScreensaverPreset,
}: LayoutEditorProps) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [exportFeedback, setExportFeedback] = useState('');

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

  const handleSelectSsTemplate = (templateKey: string) => {
    const template = SCREENSAVER_TEMPLATES[templateKey];
    if (template && onSelectScreensaverTemplate) {
      onSelectScreensaverTemplate(template.widgets);
    }
    setShowTemplatePicker(false);
  };

  const handleSelectSsPreset = (preset: { name: string; widgets: WidgetConfig[] }) => {
    if (onSelectScreensaverPreset) {
      onSelectScreensaverPreset(preset.widgets);
    }
    setShowTemplatePicker(false);
  };

  const handleExport = () => {
    const currentWidgets = editingScreensaver ? (screensaverWidgets || []) : widgets;
    const mode = editingScreensaver ? 'screensaver' : 'dashboard';
    const exportData: LayoutExport = {
      type: 'prism-layout',
      version: EXPORT_VERSION,
      mode,
      name: layoutName || (editingScreensaver ? 'Screensaver' : 'Dashboard'),
      widgets: currentWidgets
        .filter(w => w.visible !== false)
        .map(widget => {
          const reg = WIDGET_REGISTRY[widget.i];
          const exported: ExportWidget = {
            i: widget.i,
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
          };
          if (widget.backgroundColor) exported.backgroundColor = widget.backgroundColor;
          if (widget.backgroundOpacity !== undefined && widget.backgroundOpacity !== 1) {
            exported.backgroundOpacity = widget.backgroundOpacity;
          }
          if (reg?.minW) exported.minW = reg.minW;
          if (reg?.minH) exported.minH = reg.minH;
          return exported;
        }),
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2)).then(() => {
      setExportFeedback('Copied!');
      setTimeout(() => setExportFeedback(''), 2000);
    }).catch(() => {
      setExportFeedback('Failed');
      setTimeout(() => setExportFeedback(''), 2000);
    });
  };

  const handleImportOpen = () => {
    setImportText('');
    setImportError('');
    setShowImportDialog(true);
  };

  const handleImportApply = () => {
    try {
      const parsed = JSON.parse(importText);
      const validated = validateImport(parsed);
      if (!validated) {
        setImportError('Invalid layout format. Expected a Prism layout export.');
        return;
      }
      const expectedMode = editingScreensaver ? 'screensaver' : 'dashboard';
      if (validated.mode !== expectedMode) {
        setImportError(`This is a ${validated.mode} layout, but you're editing the ${expectedMode}. Switch modes first.`);
        return;
      }
      const importedWidgets = validated.widgets.map(w => ({
        i: w.i,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        visible: true,
        ...(w.backgroundColor && { backgroundColor: w.backgroundColor }),
        ...(w.backgroundOpacity !== undefined && { backgroundOpacity: w.backgroundOpacity }),
      }));
      if (editingScreensaver && onSelectScreensaverPreset) {
        onSelectScreensaverPreset(importedWidgets);
      } else {
        onWidgetsChange(importedWidgets);
      }
      setShowImportDialog(false);
    } catch {
      setImportError('Invalid JSON. Please paste a valid layout export.');
    }
  };

  return (
    <div className="bg-card/85 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EditIcon />
          <span className="text-sm font-medium">
            {editingScreensaver ? 'Screensaver Designer' : `Dashboard Designer: ${layoutName || 'Untitled Layout'}`}
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
              {editingScreensaver ? '\u2190 Dashboard Designer' : 'Screensaver Designer'}
            </button>
          )}
          {editingScreensaver ? (
            <>
              <button
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Templates
              </button>
              <button
                onClick={onScreensaverReset}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                {exportFeedback || 'Export'}
              </button>
              <button
                onClick={handleImportOpen}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Import
              </button>
              <button
                onClick={onScreensaverSaveAs}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Save As
              </button>
              <button
                onClick={onScreensaverSave}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </>
          ) : (
            <>
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
                onClick={handleExport}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                {exportFeedback || 'Export'}
              </button>
              <button
                onClick={handleImportOpen}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Import
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
            </>
          )}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {editingScreensaver && screensaverWidgets && onScreensaverWidgetToggle ? (
        <WidgetPicker widgets={screensaverWidgets} onToggle={onScreensaverWidgetToggle} widgetList={SCREENSAVER_WIDGETS} />
      ) : !editingScreensaver ? (
        <WidgetPicker widgets={widgets} onToggle={handleToggleWidget} />
      ) : null}

      {/* Import dialog */}
      {showImportDialog && (
        <div className="pt-2 border-t border-border space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Import Layout
          </div>
          <textarea
            className="w-full h-32 text-xs font-mono bg-muted text-foreground border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder='Paste exported layout JSON here...'
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
          />
          {importError && (
            <p className="text-xs text-destructive">{importError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleImportApply}
              disabled={!importText.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => setShowImportDialog(false)}
              className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template selector dropdown — screensaver mode */}
      {showTemplatePicker && editingScreensaver && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Built-in Templates</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SCREENSAVER_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleSelectSsTemplate(key)}
                  className="px-3 py-2 rounded-md bg-muted hover:bg-accent transition-colors text-left"
                >
                  <div className="text-sm font-medium">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
          {screensaverPresets.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Saved Presets</div>
              <div className="flex flex-wrap gap-2">
                {screensaverPresets.map(preset => (
                  <div key={preset.name} className="flex items-center gap-1">
                    <button
                      onClick={() => handleSelectSsPreset(preset)}
                      className="px-3 py-2 rounded-md bg-muted hover:bg-accent transition-colors text-left"
                    >
                      <div className="text-sm font-medium">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.widgets.filter(w => w.visible !== false).length} widgets</div>
                    </button>
                    {onDeleteScreensaverPreset && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete preset "${preset.name}"?`)) {
                            onDeleteScreensaverPreset(preset.name);
                          }
                        }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete preset"
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

      {/* Template selector dropdown — dashboard mode */}
      {showTemplatePicker && !editingScreensaver && (
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
