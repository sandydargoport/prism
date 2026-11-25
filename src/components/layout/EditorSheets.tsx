'use client';

/**
 * What the editor's Widgets and Look tabs hold (#1151, #1350). Each is plain
 * content; the bar draws the tab around it. Both belong to the dashboard, so
 * each opens with a scope line that says so: "Main · Every screen that shows
 * it". The dashboard's jobs are in the header menu (EditorHeader).
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { SCREENSAVER_TEMPLATES } from '@/lib/constants/screensaverTemplates';
import { TodayPartsPanel } from '@/components/today/TodayPartsPanel';
import { CommunityGallery } from './CommunityGallery';
import { CoordinateEditor } from './CoordinateEditor';
import { WidgetStylePanel } from './WidgetStylePanel';
import { ALL_WIDGET_CHOICES, colourOnAll, commonColour, differFrom, type LookPart } from './widgetLook';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';

/** Glance is the one built-in dashboard: it cannot be deleted, only edited and reset. */
export function isBuiltIn(d: { view?: string | null } | undefined): boolean {
  return d?.view === 'today';
}

/** The text size of a whole dashboard (`layouts.font_scale`), in its 13 steps. */
export const TEXT_SIZE_STEPS = [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 140, 150] as const;

// A finger on the wall gets 44px or more; a mouse on the laptop, where editing
// is done, gets controls sized like the rest of a desktop page, their words
// 12px as on every sheet of the panel (see sheetRows).
const action = 'flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-foreground/30 px-5 text-body hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8 pointer-fine:border pointer-fine:px-3 pointer-fine:text-caption pointer-fine:font-medium';
const section = 'm-0 mb-2 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground';
const SELECT = 'h-[44px] w-full min-w-0 appearance-none rounded-lg border border-border bg-background pl-3 pr-8 text-body leading-normal text-foreground pointer-fine:h-9';
const note = 'm-0 text-caption text-muted-foreground';

/** The line each tab opens with, saying whose its settings are (#1350). */
export function ScopeLine({ text }: { text: string }) {
  return <p className="m-0 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground" data-editor-scope>{text}</p>;
}

/** "Main · Every screen that shows it": the dashboard's own tabs. */
export const dashboardScope = (name: string | undefined) => `${name || 'This dashboard'} · Every screen that shows it`;

function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative min-w-0">
      <select className={cn(SELECT, className)} {...rest}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

export function WidgetsSheet({
  scope, builtIn, editingScreensaver, orientation, widgets, onWidgetsChange, onScreensaverPreset, onScreensaverTemplate, onApplyCommunityLayout, onFocusedWidgetChange,
  selectedWidgetId = null, onSelectedWidgetChange, hideEmptyByDefault = false, idleToggles = false, onCopyFromDashboard, onBackToDashboard,
}: {
  /** The scope line: whose these widgets are. */
  scope?: string;
  builtIn: boolean;
  editingScreensaver: boolean;
  orientation: 'landscape' | 'portrait';
  widgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
  onScreensaverPreset?: (w: WidgetConfig[]) => void;
  onScreensaverTemplate?: (w: WidgetConfig[]) => void;
  onApplyCommunityLayout: (widgets: WidgetConfig[], name: string) => void;
  onFocusedWidgetChange: (id: string | null) => void;
  /** The widget selected on the canvas, whose own settings show first (#1323). */
  selectedWidgetId?: string | null;
  onSelectedWidgetChange?: (id: string | null) => void;
  /** How the grid being edited draws it: see LayoutGridEditorProps. */
  hideEmptyByDefault?: boolean;
  idleToggles?: boolean;
  /** While arranging the photo frame: put the dashboard's widgets on it (#1350). */
  onCopyFromDashboard?: () => void;
  /** While arranging the photo frame: the canvas shows the dashboard again. */
  onBackToDashboard?: () => void;
}) {
  const [community, setCommunity] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();
  const templates = useMemo(() => {
    const all = editingScreensaver ? SCREENSAVER_TEMPLATES : LAYOUT_TEMPLATES;
    return Object.entries(all).filter(([, t]) => t.orientation === orientation);
  }, [editingScreensaver, orientation]);

  const scopeLine = scope ? <ScopeLine text={scope} /> : null;
  if (builtIn && !editingScreensaver) {
    return (
      <div className="flex flex-col gap-4">
        {scopeLine}
        <TodayPartsPanel widgets={widgets} onChange={onWidgetsChange} bare />
      </div>
    );
  }

  const mode = editingScreensaver ? 'screensaver' : 'dashboard';
  const change = editingScreensaver && onScreensaverPreset ? onScreensaverPreset : onWidgetsChange;
  // A widget hidden or removed is no longer selected, as on the canvas.
  const selected = selectedWidgetId ? widgets.find((w) => w.i === selectedWidgetId && w.visible !== false) : undefined;
  // A template or a gallery layout replaces every widget here and its fill,
  // outline and text, so it asks first (#1339).
  const askToReplace = (name: string) => confirm(
    `Use ${name}?`,
    `${name} replaces every widget on this ${editingScreensaver ? 'photo frame' : 'dashboard'}, with its place, fill, outline and text.`,
    { confirmLabel: 'Replace', variant: 'destructive' },
  );
  const applyCommunity = async (next: WidgetConfig[], name: string) => {
    if (await askToReplace(name)) onApplyCommunityLayout(next, name);
  };
  return (
    <div className="flex flex-col gap-6">
      {scopeLine}
      {editingScreensaver && (onCopyFromDashboard || onBackToDashboard) && (
        // Arranging the photo frame, a banner says so (#1350), with the copy
        // that used to be More > Use while resting.
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3" data-photo-frame-banner>
          <p className="m-0 text-body">Arranging the photo frame: what shows over the photo when the screen is idle.</p>
          <div className="flex flex-wrap gap-2">
            {onCopyFromDashboard && <button type="button" className={action} onClick={onCopyFromDashboard} data-photo-frame-copy>Copy from the dashboard</button>}
            {onBackToDashboard && <button type="button" className={action} onClick={onBackToDashboard} data-photo-frame-back>Back to the dashboard</button>}
          </div>
        </div>
      )}
      <section>
        <h3 className={section}>{editingScreensaver ? 'On the photo frame' : 'On this dashboard'}</h3>
        <CoordinateEditor widgets={widgets} onWidgetsChange={change} mode={mode} onFocusedWidgetChange={onFocusedWidgetChange}
          selectedWidgetId={selected?.i ?? null} onSelectWidget={onSelectedWidgetChange} />
      </section>
      {/* The selected widget's own settings, under the list, following the selection (#1323). */}
      <section data-widget-settings-section>
        {selected ? (
          <WidgetStylePanel
            widget={selected}
            onChange={(next) => change(widgets.map((w) => (w.i === next.i ? next : w)))}
            allWidgets={widgets}
            onAllChange={change}
            onClose={onSelectedWidgetChange ? () => onSelectedWidgetChange(null) : undefined}
            hideEmptyByDefault={hideEmptyByDefault}
            idleToggles={idleToggles}
            staysToggle={!editingScreensaver}
          />
        ) : (
          <p className="m-0 text-body text-muted-foreground" data-widget-settings-hint>
            Pick a widget above to change its fill, outline and text.
          </p>
        )}
      </section>
      <section>
        <h3 className={section}>Start from a template</h3>
        <div className="flex flex-wrap gap-2">
          {templates.map(([key, t]) => (
            <button
              key={key}
              type="button"
              className={action}
              onClick={async () => {
                if (!(await askToReplace(t.name))) return;
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
            <CommunityGallery mode={mode} onApplyLayout={applyCommunity} currentOrientation={orientation} />
          </div>
        )}
      </section>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

const PART_NAMES: Record<LookPart, string> = { fill: 'Fill', outline: 'Outline', text: 'Text' };
const PART_WORDS: Record<LookPart, string> = { fill: 'fill', outline: 'outline', text: 'text colour' };

/** One row of Look > All widgets: the choice, Apply to all, and how many differ. */
function AllWidgetsRow({ part, widgets, onWidgetsChange }: {
  part: LookPart;
  widgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
}) {
  // What most of them have, until another is picked.
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? commonColour(widgets, part);
  const differ = differFrom(widgets, part, value);
  const name = PART_NAMES[part];
  const choices = ALL_WIDGET_CHOICES[part];
  const known = choices.some(([v]) => v === value);
  return (
    <div className="contents" data-all-widgets={part}>
      <span className="text-body font-medium">{name}</span>
      <Select aria-label={`${name} for all widgets`} value={value} onChange={(e) => setPicked(e.target.value)}>
        {!known && <option value={value}>Own colours</option>}
        {choices.map(([v, label]) => <option key={v || 'theme'} value={v}>{label}</option>)}
      </Select>
      <button type="button" className={action} disabled={differ === 0} aria-label={`Apply this ${PART_WORDS[part]} to all widgets`}
        onClick={() => onWidgetsChange(colourOnAll(widgets, part, value))} data-apply-all-widgets={part}>
        Apply to all
      </button>
      <p className={cn(note, 'col-span-3 -mt-1')} data-all-widgets-note={part}>
        {differ === 0 ? `Every widget has this ${PART_WORDS[part]}.`
          : `${differ} ${differ === 1 ? 'widget has' : 'widgets have'} a different ${PART_WORDS[part]}.`}
      </p>
    </div>
  );
}

/**
 * Look (#1350): the dashboard's look, on every screen that shows it. Its text
 * size, in the 13 steps that were Settings > Text Size, and one fill,
 * outline and text colour for all its widgets. Glance has no cards, so it has
 * the text size only. Light or dark and the photos behind are the screen's,
 * on the Screen tab; the palette is the household's, in Settings.
 */
export function LookSheet({ scope, builtIn, fontScale, onFontScaleChange, widgets, onWidgetsChange }: {
  scope?: string;
  builtIn: boolean;
  /** The dashboard's text size, as a percentage, as being edited. */
  fontScale: number;
  onFontScaleChange?: (scale: number) => void;
  widgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
}) {
  return (
    <div className="flex flex-col gap-5" data-look-sheet>
      {scope && <ScopeLine text={scope} />}
      <div className="grid grid-cols-[5.5rem_minmax(0,12rem)] items-center gap-x-3">
        <label htmlFor="look-text-size" className="text-body font-medium">Text size</label>
        <Select id="look-text-size" value={String(fontScale)} data-look-text-size
          onChange={(e) => onFontScaleChange?.(Number(e.target.value))}>
          {TEXT_SIZE_STEPS.map((s) => <option key={s} value={String(s)}>{s}%</option>)}
        </Select>
      </div>
      <p className={note}>How large everything reads, on every screen that shows this dashboard. Each widget&apos;s own text size is on Widgets.</p>
      {builtIn ? (
        <p className="m-0 text-body text-muted-foreground" data-look-glance>Glance has no cards.</p>
      ) : (
        <section>
          <h3 className={section}>All widgets</h3>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3">
            {(['fill', 'outline', 'text'] as const).map((part) => (
              <AllWidgetsRow key={part} part={part} widgets={widgets} onWidgetsChange={onWidgetsChange} />
            ))}
          </div>
        </section>
      )}
      <p className={note}>
        The photo frame has its own outline switch: Screen &gt; When idle &gt; Advanced. Light or dark and the photos behind the dashboard are on the Screen tab; the palette is in Settings &gt; Appearance.
      </p>
    </div>
  );
}
