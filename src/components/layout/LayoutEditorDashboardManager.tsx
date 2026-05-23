'use client';

import { useState } from 'react';
import { PopoverButton } from './LayoutEditorPopover';
import { CheckIcon } from './LayoutEditorIcons';
import type { DashboardInfo } from './LayoutEditorTypes';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const moreItemClass = 'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors';

export function DashboardDropdown({ layoutName, isActive, onToggle, allDashboards, currentDashboardId, onSwitchDashboard, onClose, onCreateOpen }: {
  layoutName?: string; isActive: boolean; onToggle: () => void;
  allDashboards: DashboardInfo[]; currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void; onClose: () => void; onCreateOpen: () => void;
}) {
  return (
    <PopoverButton
      label={<span className="font-medium">{layoutName || 'Untitled'}</span>}
      isActive={isActive}
      onToggle={onToggle}
      width={220}
    >
      <div className="py-1 max-h-[40vh] overflow-auto">
        {allDashboards.map(d => (
          <button key={d.id} onClick={() => {
            if (d.id !== currentDashboardId && d.slug) {
              sessionStorage.setItem('prism:editing', 'true'); onSwitchDashboard?.(d.slug);
            } else if (d.id !== currentDashboardId && d.isDefault) {
              sessionStorage.setItem('prism:editing', 'true'); window.location.href = '/';
            }
            onClose();
          }} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${d.id === currentDashboardId ? 'bg-accent/50' : ''}`}>
            <span className="flex-1 truncate">{d.name}</span>
            {d.id === currentDashboardId && <CheckIcon />}
            {d.isDefault && d.id !== currentDashboardId && <span className="text-[10px] text-muted-foreground">default</span>}
          </button>
        ))}
        <div className="border-t border-border my-1" />
        <button onClick={onCreateOpen} className={`${moreItemClass} text-primary`}>+ New Dashboard...</button>
      </div>
    </PopoverButton>
  );
}

/**
 * Save-As picker. Lets the user save the current edit session either as a
 * new dashboard (name input) OR by overwriting one of the existing
 * dashboards (button row, confirm-on-click). Overwriting preserves the
 * target's name, slug, and isDefault — it's the layout content (widgets +
 * screensaver) that gets swapped.
 */
export function SaveAsDialog({
  open,
  onClose,
  allDashboards,
  currentDashboardId,
  onOverwrite,
  onCreateNew,
}: {
  open: boolean;
  onClose: () => void;
  allDashboards: DashboardInfo[];
  currentDashboardId?: string;
  onOverwrite: (id: string) => void;
  onCreateNew: (name: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<DashboardInfo | null>(null);

  if (!open) return null;

  const handleCreateNew = () => {
    if (!newName.trim()) return;
    onCreateNew(newName.trim());
    setNewName('');
    onClose();
  };

  const handleOverwriteClick = (d: DashboardInfo) => {
    setConfirmTarget(d);
  };

  const handleConfirmOverwrite = () => {
    if (!confirmTarget) return;
    onOverwrite(confirmTarget.id);
    setConfirmTarget(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="text-sm font-medium">Save As</div>

          {/* Overwrite existing */}
          {allDashboards.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Overwrite an existing dashboard</div>
              <div className="space-y-1 max-h-[30vh] overflow-auto">
                {allDashboards.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleOverwriteClick(d)}
                    className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <span className="flex-1 truncate">{d.name}</span>
                    {d.id === currentDashboardId && (
                      <span className="text-[10px] text-muted-foreground">current</span>
                    )}
                    {d.isDefault && d.id !== currentDashboardId && (
                      <span className="text-[10px] text-muted-foreground">default</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New dashboard */}
          <div className="border-t border-border pt-3">
            <label className="text-xs text-muted-foreground block mb-1">Save as a new dashboard</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New dashboard name"
                className="flex-1 px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={100}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); }}
              />
              <button
                onClick={handleCreateNew}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={`Overwrite "${confirmTarget?.name ?? ''}"?`}
        description={`This will replace the saved widgets and screensaver for "${confirmTarget?.name ?? ''}" with the current edit session. The dashboard's name, slug, and default flag are preserved.`}
        confirmLabel="Overwrite"
        variant="destructive"
        onConfirm={handleConfirmOverwrite}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

export function CreateDashboardDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, startFrom: 'blank' | 'template' | 'copy') => void;
}) {
  const [createForm, setCreateForm] = useState({ name: '', startFrom: 'template' as 'blank' | 'template' | 'copy' });

  if (!open) return null;

  const handleSubmit = () => {
    if (!createForm.name.trim()) return;
    onCreate(createForm.name.trim(), createForm.startFrom);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-medium">New Dashboard</div>
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <input
            type="text"
            value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Kitchen Display"
            className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={100}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Start from</label>
          <div className="flex gap-2">
            {([
              { value: 'template' as const, label: 'Default Template' },
              { value: 'copy' as const, label: 'Copy Current' },
              { value: 'blank' as const, label: 'Blank' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setCreateForm(f => ({ ...f, startFrom: opt.value }))}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  createForm.startFrom === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:bg-accent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!createForm.name.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
