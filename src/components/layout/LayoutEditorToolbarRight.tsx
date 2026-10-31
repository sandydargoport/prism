'use client';

import { PopoverButton } from './LayoutEditorPopover';
import { ChevronIcon } from './LayoutEditorIcons';
import type { ActivePopover, DashboardInfo } from './LayoutEditorTypes';
import type { EditTab } from '@/components/dashboard/useDashboardLayout';


interface ToolbarRightProps {
  editingScreensaver: boolean;
  editTab: EditTab;
  onEditTabChange: (tab: EditTab) => void;
  /** Which tabs hold unsaved changes: each gets a dot. */
  dashboardDirty?: boolean;
  idleDirty?: boolean;
  activePopover: ActivePopover;
  onTogglePopover: (name: ActivePopover) => void;
  saveFeedback: string;
  exportFeedback: string;
  allDashboards: DashboardInfo[];
  currentDashboardId?: string;
  onToggleMeasureMode: () => void;
  /** Why Save is refused right now, or null. */
  saveBlocked?: string | null;
  onSave: () => void;
  onSaveAs: () => void;
  onReset: () => void;
  onScreensaverReset?: () => void;
  onCancel: () => void;
  onExport: () => void;
  onImportOpen: () => void;
  onShareOpen: () => void;
  /** Copy this layout over the other one: Use as idle screen / Use as dashboard. */
  onCopyToOther?: () => void;
  onDeleteDashboard?: () => void;
  onHandleDelete: () => void;
}

const btnClass = 'px-2 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors';
const moreItemClass = 'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors';

export function LayoutEditorToolbarRight({
  editingScreensaver,
  editTab,
  onEditTabChange,
  dashboardDirty = false,
  idleDirty = false,
  activePopover,
  onTogglePopover,
  saveFeedback,
  exportFeedback,
  allDashboards,
  currentDashboardId,
  onToggleMeasureMode,
  saveBlocked = null,
  onSave,
  onSaveAs,
  onReset,
  onScreensaverReset,
  onCancel,
  onExport,
  onImportOpen,
  onShareOpen,
  onCopyToOther,
  onDeleteDashboard,
  onHandleDelete,
}: ToolbarRightProps) {
  const tab = (id: EditTab, label: string, dirty: boolean) => (
    <button
      role="tab"
      aria-selected={editTab === id}
      data-dirty={dirty || undefined}
      onClick={() => onEditTabChange(id)}
      className={`${btnClass} flex items-center gap-1 ${
        editTab === id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
      }`}
    >
      {label}
      {dirty && <span aria-label="unsaved changes" className="w-1.5 h-1.5 rounded-full bg-current" />}
    </button>
  );
  const idleTab = editTab === 'idle';

  return (
    <div className="flex items-center gap-2">
      {/* The dashboard, and what shows when nobody is using it (#782). One
          Save keeps both; Cancel undoes both. */}
      <div role="tablist" aria-label="Edit" className="flex rounded-md bg-muted p-0.5">
        {tab('dashboard', 'Dashboard', dashboardDirty)}
        {tab('idle', 'Idle screen', idleDirty)}
      </div>

      {/* Screen Preview */}
      <button
        onClick={onToggleMeasureMode}
        className={`${btnClass} bg-muted hover:bg-accent`}
        title="Preview layout as it appears on a specific screen (Ctrl+Shift+M)"
      >
        Preview
      </button>

      {/* Save split button */}
      <div className="relative flex">
        <button
          onClick={onSave}
          disabled={!!saveBlocked}
          title={saveBlocked ?? undefined}
          className="px-2 py-1.5 text-xs rounded-l-md whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveFeedback || 'Save'}
        </button>
        <button
          onClick={() => onTogglePopover('save')}
          className="px-1.5 py-1.5 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors border-l border-primary-foreground/20"
          aria-label="Save options"
        >
          <ChevronIcon open={activePopover === 'save'} />
        </button>
        {activePopover === 'save' && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-popover border border-border rounded-md shadow-md py-1">
            <button
              onClick={() => { onSaveAs(); onTogglePopover('save'); }}
              className={moreItemClass}
            >
              Save As...
            </button>
          </div>
        )}
      </div>

      {/* More dropdown */}
      <PopoverButton
        label="More"
        isActive={activePopover === 'more'}
        onToggle={() => onTogglePopover('more')}
        width={200}
        align="right"
      >
        <div className="py-1">
          {!idleTab && currentDashboardId && (() => {
            const current = allDashboards.find(d => d.id === currentDashboardId);
            const alreadyDefault = current?.isDefault === true;
            return (
              <button
                onClick={async () => {
                  if (alreadyDefault) return;
                  try {
                    const res = await fetch(`/api/layouts/${currentDashboardId}/default`, { method: 'POST' });
                    if (res.ok) window.location.reload();
                  } catch { /* ignore — UI stays put on failure */ }
                  onTogglePopover('more');
                }}
                className={`${moreItemClass} ${alreadyDefault ? 'text-muted-foreground cursor-not-allowed' : ''}`}
                disabled={alreadyDefault}
                title={alreadyDefault ? 'Already the default dashboard' : 'Make this the dashboard shown at /'}
              >
                {alreadyDefault ? 'Default Dashboard ✓' : 'Set as Default'}
              </button>
            );
          })()}
          {!idleTab && currentDashboardId && (
            <div className="border-t border-border my-1" />
          )}
          {!idleTab && onDeleteDashboard && (
            <button
              onClick={onHandleDelete}
              className={`${moreItemClass} ${
                allDashboards.length <= 1 ? 'text-muted-foreground cursor-not-allowed' : 'text-destructive'
              }`}
              disabled={allDashboards.length <= 1}
            >
              Delete Dashboard
            </button>
          )}
          {!idleTab && onDeleteDashboard && (
            <div className="border-t border-border my-1" />
          )}
          {/* A dashboard that is its own idle screen has no idle layout to
              reset or pass around. */}
          {(!idleTab || editingScreensaver) && <>
            <button
              onClick={() => {
                if (editingScreensaver) onScreensaverReset?.();
                else onReset();
                onTogglePopover('more');
              }}
              className={moreItemClass}
            >
              Reset
            </button>
            <button onClick={onExport} className={moreItemClass}>
              {exportFeedback || 'Export'}
            </button>
            <button onClick={onImportOpen} className={moreItemClass}>Import</button>
            <button onClick={onShareOpen} className={moreItemClass}>Share</button>
          </>}
          {onCopyToOther && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { onCopyToOther(); onTogglePopover('more'); }}
                className={moreItemClass}
              >
                {idleTab ? 'Use as dashboard' : 'Use as idle screen'}
              </button>
            </>
          )}
        </div>
      </PopoverButton>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="px-2 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
