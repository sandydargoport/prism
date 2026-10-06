'use client';

import { useRef, useState } from 'react';

// Far larger than any real layout, small enough to refuse a wrong file unread.
const MAX_FILE_BYTES = 256 * 1024;

interface LayoutExportV2 {
  type: 'prism-layout';
  version: number;
  mode: 'dashboard' | 'screensaver';
  name: string;
  description: string;
  author: string;
  tags: string[];
  screenSizes: string[];
  orientation: 'landscape' | 'portrait';
  widgets: Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    minW?: number;
    minH?: number;
  }>;
}

function validateImport(data: unknown): LayoutExportV2 | null {
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
  return obj as unknown as LayoutExportV2;
}

export function LayoutEditorImportDialog({
  open,
  onClose,
  editingScreensaver,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  editingScreensaver: boolean;
  onApply: (widgets: Array<{ i: string; x: number; y: number; w: number; h: number; visible: boolean; backgroundColor?: string; backgroundOpacity?: number }>) => void;
}) {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // Reads a downloaded layout file into the box, so it goes through the same
  // checks as pasted text and the person can see what they are applying.
  const handleFile = async (file: File) => {
    setImportError('');
    if (file.size > MAX_FILE_BYTES) {
      setImportError('This file is too large to be a Prism layout.');
      return;
    }
    setImportText(await file.text());
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
        visible: true as const,
        ...(w.backgroundColor && { backgroundColor: w.backgroundColor }),
        ...(w.backgroundOpacity !== undefined && { backgroundOpacity: w.backgroundOpacity }),
      }));
      onApply(importedWidgets);
      onClose();
    } catch {
      setImportError('Invalid JSON. Please paste a valid layout export.');
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-lg w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-medium">Import Layout</div>
        <textarea
          className="w-full h-32 text-xs font-mono bg-muted text-foreground border border-border rounded-md p-2 resize-none focus:outline-hidden focus:ring-2 focus:ring-primary"
          placeholder='Paste exported layout JSON here, or choose a file below'
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
        />
        {importError && (
          <p className="text-xs text-destructive">{importError}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => fileRef.current?.click()}
            className="mr-auto px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Choose file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="layout-import-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImportApply}
            disabled={!importText.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
