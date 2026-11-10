'use client';

/**
 * What the editing bar's sheets hold (#1151). Each is plain content; the bar
 * draws the sheet around it.
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { SCREENSAVER_TEMPLATES } from '@/lib/constants/screensaverTemplates';
import { TodayPartsPanel } from '@/components/today/TodayPartsPanel';
import { editLink } from '@/components/dashboard/useDashboardLayout';
import { CommunityGallery } from './CommunityGallery';
import { CoordinateEditor } from './CoordinateEditor';
import { LayoutEditorPreviewPanel } from './LayoutEditorPreviewPanel';
import type { DashboardInfo } from './LayoutEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { ScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { cn } from '@/lib/utils';

/** Today is the one built-in dashboard: it cannot be deleted, only edited and reset. */
export function isBuiltIn(d: { view?: string | null } | undefined): boolean {
  return d?.view === 'today';
}

const action = 'flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-foreground/30 px-5 text-body hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';
const row = 'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-body hover:bg-muted';
const section = 'm-0 mb-2 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground';

export function DashboardSheet({
  allDashboards, currentDashboardId, onSwitchDashboard, onAddToday, onCreateOpen, onRenameOpen, onSaveAsOpen, onSetDefault, onDelete, onResetBuiltIn,
}: {
  allDashboards: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  /** An install with no Today yet: add it. */
  onAddToday?: () => void;
  onCreateOpen: () => void;
  onRenameOpen: () => void;
  onSaveAsOpen: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
  onResetBuiltIn?: () => void;
}) {
  const current = allDashboards.find((d) => d.id === currentDashboardId);
  const builtIn = isBuiltIn(current);
  const hasToday = allDashboards.some(isBuiltIn);
  // Built in first, then the family's own in their order.
  const listed = [...allDashboards.filter(isBuiltIn), ...allDashboards.filter((d) => !isBuiltIn(d))];
  const open = (d: DashboardInfo) => {
    if (d.id === currentDashboardId) return;
    if (d.slug) onSwitchDashboard?.(d.slug);
    else if (d.isDefault) window.location.assign(editLink('/'));
  };
  return (
    <div className="flex flex-col gap-5">
      <ul className="m-0 flex list-none flex-col gap-1 p-0" data-dashboard-list>
        {!hasToday && onAddToday && (
          <li>
            <button type="button" onClick={onAddToday} className={row} data-dashboard-row="today-add">
              <span className="flex-1 italic" style={{ fontFamily: 'var(--font-display)' }}>Today</span>
              <BuiltInMark />
              <span className="text-caption text-muted-foreground">Add</span>
            </button>
          </li>
        )}
        {listed.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => open(d)}
              aria-current={d.id === currentDashboardId || undefined}
              className={cn(row, d.id === currentDashboardId && 'bg-muted')}
              data-dashboard-row={d.id}
              data-built-in={isBuiltIn(d) || undefined}
            >
              {/* The built-in dashboard reads differently: the display face, in italics. */}
              <span className={cn('flex-1 truncate', isBuiltIn(d) && 'italic')} style={isBuiltIn(d) ? { fontFamily: 'var(--font-display)' } : undefined}>
                {d.name}
              </span>
              {isBuiltIn(d) && <BuiltInMark />}
              {d.isDefault && <span className="text-caption text-muted-foreground">Default</span>}
              {d.id === currentDashboardId && <span className="text-caption font-medium">Editing</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCreateOpen} className={action} data-dashboard-new>New dashboard</button>
        <button type="button" onClick={onSaveAsOpen} className={action} data-dashboard-copy>Make a copy</button>
        {!builtIn && <button type="button" onClick={onRenameOpen} className={action}>Rename</button>}
        <button type="button" onClick={onSetDefault} disabled={current?.isDefault} className={action} data-dashboard-default>
          {current?.isDefault ? 'The default' : 'Make the default'}
        </button>
        {builtIn && onResetBuiltIn && (
          <button type="button" onClick={onResetBuiltIn} className={action} data-dashboard-reset>Reset to default</button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={builtIn || allDashboards.length <= 1}
          title={builtIn ? 'Today is built in and cannot be deleted' : undefined}
          className={cn(action, !builtIn && 'text-destructive')}
          data-dashboard-delete
        >
          Delete
        </button>
      </div>
      {builtIn && (
        <p className="m-0 text-caption text-muted-foreground" data-built-in-note>
          Today is built in. You can change what it shows and reset it, but not delete it. Make a copy to arrange one of your own.
        </p>
      )}
    </div>
  );
}

function BuiltInMark() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-caption text-muted-foreground" data-built-in-mark>
      <Lock className="h-3 w-3" aria-hidden />
      Built in
    </span>
  );
}

export function WidgetsSheet({
  builtIn, editingScreensaver, orientation, widgets, onWidgetsChange, onScreensaverPreset, onScreensaverTemplate, onApplyCommunityLayout, onFocusedWidgetChange,
}: {
  builtIn: boolean;
  editingScreensaver: boolean;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
  onScreensaverPreset?: (w: WidgetConfig[]) => void;
  onScreensaverTemplate?: (w: WidgetConfig[]) => void;
  onApplyCommunityLayout: (widgets: WidgetConfig[], name: string) => void;
  onFocusedWidgetChange: (id: string | null) => void;
}) {
  const [community, setCommunity] = useState(false);
  const templates = useMemo(() => {
    const all = editingScreensaver ? SCREENSAVER_TEMPLATES : LAYOUT_TEMPLATES;
    return Object.entries(all).filter(([, t]) => t.orientation === orientation);
  }, [editingScreensaver, orientation]);

  if (builtIn && !editingScreensaver) return <TodayPartsPanel widgets={widgets} onChange={onWidgetsChange} bare />;

  const mode = editingScreensaver ? 'screensaver' : 'dashboard';
  const change = editingScreensaver && onScreensaverPreset ? onScreensaverPreset : onWidgetsChange;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className={section}>On this dashboard</h3>
        <CoordinateEditor widgets={widgets} onWidgetsChange={change} mode={mode} onFocusedWidgetChange={onFocusedWidgetChange} />
      </section>
      <section>
        <h3 className={section}>Start from a template</h3>
        <div className="flex flex-wrap gap-2">
          {templates.map(([key, t]) => (
            <button
              key={key}
              type="button"
              className={action}
              onClick={() => {
                if (editingScreensaver) onScreensaverTemplate?.(SCREENSAVER_TEMPLATES[key]!.widgets);
                else onWidgetsChange(LAYOUT_TEMPLATES[key]!.widgets.map((w) => ({ ...w, visible: true })));
              }}
            >
              {t.name}
            </button>
          ))}
          {templates.length === 0 && <p className="m-0 text-body text-muted-foreground">No templates for {orientation} yet.</p>}
        </div>
      </section>
      <section>
        <button type="button" className={action} onClick={() => setCommunity((v) => !v)} aria-expanded={community}>
          {community ? 'Hide the community gallery' : 'Browse the community gallery'}
        </button>
        {community && (
          <div className="mt-4">
            <CommunityGallery mode={mode} onApplyLayout={onApplyCommunityLayout} currentOrientation={orientation} />
          </div>
        )}
      </section>
    </div>
  );
}

export { ThroughTheDaySheet as DaySheet } from './ThroughTheDaySheet';

export function LookSheet({ orientation, onOrientationChange, onMeasure }: {
  orientation: 'landscape' | 'portrait';
  onOrientationChange?: (o: 'landscape' | 'portrait') => void;
  onMeasure: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className={section}>Screen shape</h3>
        <div className="flex gap-2" role="radiogroup" aria-label="Screen shape">
          {(['landscape', 'portrait'] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={orientation === o}
              onClick={() => onOrientationChange?.(o)}
              className={cn(action, orientation === o && 'border-foreground bg-foreground text-background hover:bg-foreground')}
            >
              {o === 'landscape' ? 'Landscape' : 'Portrait'}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className={section}>Check it</h3>
        <button type="button" className={action} onClick={onMeasure}>See it at a screen size</button>
      </section>
    </div>
  );
}

export function MoreSheet({
  builtIn, editingScreensaver, hasIdleLayout, idleTab, exportFeedback, onExport, onImportOpen, onShareOpen, onReset, onCopyToOther, preview,
}: {
  builtIn: boolean;
  editingScreensaver: boolean;
  hasIdleLayout: boolean;
  idleTab: boolean;
  exportFeedback: string;
  onExport: () => void;
  onImportOpen: () => void;
  onShareOpen: () => void;
  onReset: () => void;
  onCopyToOther?: () => void;
  preview?: React.ReactNode;
}) {
  const grid = !builtIn || editingScreensaver;
  return (
    <div className="flex flex-col gap-5">
      {grid && preview && (
        <section>
          <h3 className={section}>Overview</h3>
          {preview}
        </section>
      )}
      <section>
        <h3 className={section}>Share and back up</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} onClick={onExport}>{exportFeedback || 'Export'}</button>
          {grid && <button type="button" className={action} onClick={onImportOpen}>Import</button>}
          {grid && <button type="button" className={action} onClick={onShareOpen}>Share to the gallery</button>}
        </div>
      </section>
      {grid && (
        <section>
          <h3 className={section}>Start again</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={action} onClick={onReset}>Reset this layout</button>
            {onCopyToOther && hasIdleLayout && (
              <button type="button" className={action} onClick={onCopyToOther}>{idleTab ? 'Use as the dashboard' : 'Use while resting'}</button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export { LayoutEditorPreviewPanel };
export type { ScreenSafeZones };
