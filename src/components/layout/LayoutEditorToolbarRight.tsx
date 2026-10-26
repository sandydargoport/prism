'use client';

import { PopoverButton } from './LayoutEditorPopover';
import { ChevronIcon } from './LayoutEditorIcons';
import type { ActivePopover, DashboardInfo } from './LayoutEditorTypes';
import type { ScreensaverMode } from '@/lib/hooks/useLayouts';

interface ToolbarRightProps {
  editingScreensaver: boolean;
  activePopover: ActivePopover;
  onTogglePopover: (name: ActivePopover) => void;
  saveLabel: string;
  saveFeedback: string;
  exportFeedback: string;
  allDashboards: DashboardInfo[];
  currentDashboardId?: string;
  onToggleMeasureMode: () => void;
  screensaverMode?: ScreensaverMode;
  onScreensaverModeChange?: (mode: ScreensaverMode) => void;
  onToggleScreensaverEdit?: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onReset: () => void;
  onScreensaverReset?: () => void;
  onCancel: () => void;
  onExport: () => void;
  onImportOpen: () => void;
  onShareOpen: () => void;
  /** Copy this layout over the other one (dashboard <-> screensaver). */
  onCopyToOther?: () => void;
  onDeleteDashboard?: () => void;
  onHandleDelete: () => void;
}

const btnClass = 'px-2 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors';
const moreItemClass = 'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors';

export function LayoutEditorToolbarRight({
  editingScreensaver,
  activePopover,
  onTogglePopover,
  saveLabel,
  saveFeedback,
  exportFeedback,
  allDashboards,
  currentDashboardId,
  onToggleMeasureMode,
  screensaverMode,
  onScreensaverModeChange,
  onToggleScreensaverEdit,
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
  return (
    <div className="flex items-center gap-2">
      {/* Screen Preview */}
      <button
        onClick={onToggleMeasureMode}
        className={`${btnClass} bg-muted hover:bg-accent`}
        title="Preview layout as it appears on a specific screen (Ctrl+Shift+M)"
      >
        Preview
      </button>

      {/* What the display shows when idle: this dashboard, or the separate
          screensaver layout. Saved as soon as it is picked. */}
      {!editingScreensaver && screensaverMode && onScreensaverModeChange && (
        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
          When nobody&apos;s using it:
          <select
            value={screensaverMode}
            onChange={(e) => onScreensaverModeChange(e.target.value as ScreensaverMode)}
            className={`${btnClass} bg-muted hover:bg-accent`}
          >
            <option value="calm">Fade to a calm view of this dashboard</option>
            <option value="separate">Show the screensaver</option>
          </select>
        </label>
      )}

      {/* Screensaver toggle */}
      {onToggleScreensaverEdit && (
        <button
          onClick={onToggleScreensaverEdit}
          className={`${btnClass} ${
            editingScreensaver
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted hover:bg-accent'
          }`}
        >
          {editingScreensaver ? '\u2190 Dashboard' : 'Screensaver'}
        </button>
      )}

      {/* Save split button */}
      {editingScreensaver ? (
        <button
          onClick={onSave}
          className="px-2 py-1.5 text-xs rounded-md whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {saveLabel}
        </button>
      ) : (
        <div className="relative flex">
          <button
            onClick={onSave}
            className="px-2 py-1.5 text-xs rounded-l-md whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {saveFeedback || saveLabel}
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
      )}

      {/* More dropdown */}
      <PopoverButton
        label="More"
        isActive={activePopover === 'more'}
        onToggle={() => onTogglePopover('more')}
        width={200}
        align="right"
      >
        <div className="py-1">
          {!editingScreensaver && currentDashboardId && (() => {
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
          {!editingScreensaver && currentDashboardId && (
            <div className="border-t border-border my-1" />
          )}
          {!editingScreensaver && onDeleteDashboard && (
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
          {!editingScreensaver && onDeleteDashboard && (
            <div className="border-t border-border my-1" />
          )}
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
          {onCopyToOther && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { onCopyToOther(); onTogglePopover('more'); }}
                className={moreItemClass}
              >
                {editingScreensaver ? 'Copy to dashboard' : 'Copy to screensaver'}
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
