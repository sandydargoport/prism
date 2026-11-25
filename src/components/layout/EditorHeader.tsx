'use client';

/**
 * The editor's header (#1350): which screen is edited, and Editing, the
 * dashboard the canvas has open, with a menu for the dashboard's jobs.
 *
 *   Hallway screen  ·  Editing [Main dashboard v]  [...]
 *
 * The screen drop-down opens another screen's editor, and the pencil beside
 * it renames this one, at once, as Settings > Screens does: a name is not
 * part of Done. Editing changes only which dashboard the canvas has open; it
 * never changes what the screen shows, which is Screen > Shows > Normally.
 * The menu holds the jobs that belong to the dashboard as a whole: New, Make
 * a copy, Rename, Export, Import, Share to the gallery, Reset and Delete.
 *
 * It is drawn in the editor page's header, over the picture, at this device's
 * own size; with no such place (a test) it is drawn where it is.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MoreHorizontal, Pencil } from 'lucide-react';
import { remoteCanvasSlot } from '@/lib/displays/remoteEdit';
import { screenEditLink } from '@/lib/displays/editPlace';
import type { SwitchChoice } from './SwitchPrompt';
import type { DashboardInfo } from './LayoutEditorTypes';
import { cn } from '@/lib/utils';

const NAME_MAX = 60;

export type Named = { id: string; name: string };

/** The named screens, once read; null before. */
export function useScreens(): [Named[] | null, React.Dispatch<React.SetStateAction<Named[] | null>>] {
  const [screens, setScreens] = useState<Named[] | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      let data: { displays?: unknown } | null = null;
      try {
        const res = await fetch('/api/displays');
        data = res.ok ? await res.json() : null;
      } catch { /* no list: no picker */ }
      if (!live) return;
      setScreens(((data?.displays ?? []) as Array<Partial<Named>>)
        .flatMap((d) => (typeof d.id === 'string' && typeof d.name === 'string' ? [{ id: d.id, name: d.name }] : [])));
    })();
    return () => { live = false; };
  }, []);
  return [screens, setScreens];
}

async function problemFrom(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return 'Only a parent can rename a screen.';
  return data?.error ?? 'That did not work. Try again.';
}

/**
 * Opens another screen's editor, as Settings > Screens > Edit does. With
 * changes not saved, it asks first (#1341): Save and switch saves them as
 * Done does and then opens it, Discard opens it without them, Stay stays.
 */
export async function openOtherScreen(id: string, { unsaved, ask, save, go }: {
  unsaved: boolean;
  ask: () => Promise<SwitchChoice>;
  /** Done, then on to `href`. */
  save: (href: string) => Promise<void>;
  go?: (href: string) => void;
}): Promise<boolean> {
  const href = screenEditLink(id);
  if (unsaved) {
    const choice = await ask();
    if (choice === 'stay') return false;
    if (choice === 'save') {
      await save(href);
      return true;
    }
  }
  // The editor's page, not the canvas's frame this header is drawn from.
  (go ?? ((to: string) => (window.top ?? window).location.assign(to)))(href);
  return true;
}

/** "Hallway" as the header says it: "Hallway screen"; a name that already says so is left be. */
export function withKind(name: string, kind: 'screen' | 'dashboard'): string {
  return new RegExp(`\\b${kind}$`, 'i').test(name.trim()) ? name : `${name} ${kind}`;
}

/** One of the dashboard's jobs, in the header menu. */
export type DashboardJob = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Why it is disabled. */
  title?: string;
  destructive?: boolean;
};

const SELECT = 'h-[44px] min-w-0 appearance-none rounded-lg border border-border bg-background pl-3 pr-8 text-body leading-normal text-foreground pointer-fine:h-9';
const ICON = 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-fine:h-9 pointer-fine:w-9';

function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex min-w-0">
      <select className={cn(SELECT, className)} {...rest}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </span>
  );
}

/** The `...` menu of the dashboard's jobs. */
function JobsMenu({ jobs, note }: { jobs: DashboardJob[]; note?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // A press anywhere else closes it. The header is drawn on the editor
  // page, another document than the frame this runs in: listen on its own.
  useEffect(() => {
    if (!open) return;
    const doc = ref.current?.ownerDocument ?? document;
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    doc.addEventListener('pointerdown', away);
    doc.addEventListener('keydown', esc);
    return () => { doc.removeEventListener('pointerdown', away); doc.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Dashboard jobs" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={cn(ICON, 'border border-border bg-background')} data-dashboard-jobs>
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Dashboard jobs"
          className="absolute left-0 top-full z-50 mt-1 flex w-64 flex-col rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          data-dashboard-menu>
          {jobs.map((job) => (
            <button key={job.id} type="button" role="menuitem" disabled={job.disabled} title={job.title}
              onClick={() => { setOpen(false); job.onSelect(); }}
              className={cn(
                'flex min-h-[44px] items-center rounded-lg px-3 text-left text-body hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-9',
                job.destructive && 'text-destructive',
              )}
              data-dashboard-job={job.id}>
              {job.label}
            </button>
          ))}
          {note && <p className="m-0 px-3 pb-1.5 pt-1 text-caption text-muted-foreground" data-dashboard-menu-note>{note}</p>}
        </div>
      )}
    </div>
  );
}

export function EditorHeader({
  screenId, deviceNamed, screens, onScreensChange, onPickScreen, onRenamed,
  dashboards, currentDashboardId, onPickDashboard, jobs, menuNote,
}: {
  /** The named screen being edited, or null for a dashboard on its own. */
  screenId: string | null;
  /** The device in use has a name: with no screen, the drop-down says No screen. */
  deviceNamed: boolean;
  /** The named screens, once read. */
  screens: Named[] | null;
  onScreensChange: React.Dispatch<React.SetStateAction<Named[] | null>>;
  /** Edit another named screen instead. */
  onPickScreen?: (id: string) => void;
  /** The screen was renamed, to this. */
  onRenamed?: (name: string) => void;
  dashboards: DashboardInfo[];
  currentDashboardId?: string;
  /** Open another dashboard on the canvas. */
  onPickDashboard: (d: DashboardInfo) => void;
  jobs: DashboardJob[];
  menuNote?: string;
}) {
  /** The name as typed while renaming; null shows the drop-down. */
  const [draft, setDraft] = useState<string | null>(null);
  // Whether a rename is still open to save: Esc, or a save under way, closes
  // it, so the blur as the field goes does not save again.
  const renameOpen = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = screenId ? screens?.find((s) => s.id === screenId)?.name ?? null : null;

  const startRename = () => { renameOpen.current = true; setProblem(null); setDraft(name ?? ''); };
  const cancelRename = () => { renameOpen.current = false; setProblem(null); setDraft(null); };
  /** Saves the name typed, on Enter or on leaving the field; an unchanged or empty one goes back. */
  const rename = async () => {
    if (!screenId || draft === null || !renameOpen.current) return;
    renameOpen.current = false;
    const next = draft.trim();
    if (!next || next === name) { setDraft(null); return; }
    setBusy(true);
    setProblem(null);
    try {
      // At once, as Settings > Screens renames one: a name is not part of Done.
      const res = await fetch(`/api/displays/${encodeURIComponent(screenId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      }).catch(() => null);
      if (!res?.ok) {
        // The field stays, with why, to try again or Esc.
        renameOpen.current = true;
        setProblem(res ? await problemFrom(res) : 'That did not work. Try again.');
        return;
      }
      onScreensChange((list) => list?.map((s) => (s.id === screenId ? { ...s, name: next } : s)) ?? list);
      setDraft(null);
      onRenamed?.(next);
    } finally {
      setBusy(false);
    }
  };

  const builtIn = (d: DashboardInfo) => d.view === 'today';
  // Built in first, then the family's own in their order.
  const listed = [...dashboards.filter(builtIn), ...dashboards.filter((d) => !builtIn(d))];
  const hasPicker = !!screenId || (screens?.length ?? 0) > 0;

  const header = (
    <div className="flex flex-col gap-1 pb-2" data-editor-header>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        {draft !== null ? (
          <form onSubmit={(e) => { e.preventDefault(); void rename(); }}>
            <input className={cn(SELECT, 'w-56 px-3')} maxLength={NAME_MAX} disabled={busy} autoFocus
              aria-label="Name of this screen" value={draft} data-screen-name
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRename(); } }}
              onBlur={() => void rename()} />
          </form>
        ) : hasPicker ? (
          <span className="flex min-w-0 items-center gap-1">
            <label htmlFor="editor-header-screen" className="sr-only">Screen</label>
            <Select id="editor-header-screen" value={screenId ?? ''} className="font-medium" data-screen-pick
              onChange={(e) => { if (e.target.value && e.target.value !== screenId) onPickScreen?.(e.target.value); }}>
              {!screenId && <option value="">{deviceNamed ? 'No screen' : 'Not named yet'}</option>}
              {screenId && !screens?.some((s) => s.id === screenId) && <option value={screenId}>{name ?? '…'}</option>}
              {(screens ?? []).map((s) => <option key={s.id} value={s.id}>{withKind(s.name, 'screen')}</option>)}
            </Select>
            {screenId && name !== null && (
              <button type="button" aria-label={`Rename ${name}`} onClick={startRename} className={ICON} data-screen-rename>
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            )}
          </span>
        ) : (
          // No named screen to pick: what this one is, in words.
          <span className="text-body font-medium" data-screen-unnamed>{deviceNamed ? 'No screen' : 'Not named yet'}</span>
        )}
        <span className="text-muted-foreground" aria-hidden>·</span>
        <label htmlFor="editor-header-editing" className="text-body text-muted-foreground">Editing</label>
        <Select id="editor-header-editing" value={currentDashboardId ?? ''} data-editor-editing
          onChange={(e) => {
            const d = dashboards.find((x) => x.id === e.target.value);
            if (d && d.id !== currentDashboardId) onPickDashboard(d);
          }}>
          {!dashboards.some((d) => d.id === currentDashboardId) && <option value={currentDashboardId ?? ''}>…</option>}
          {listed.map((d) => <option key={d.id} value={d.id}>{withKind(d.name, 'dashboard')}</option>)}
        </Select>
        <JobsMenu jobs={jobs} note={menuNote} />
      </div>
      {problem && <p role="alert" className="m-0 text-body text-destructive">{problem}</p>}
    </div>
  );
  const slot = remoteCanvasSlot('header');
  return slot ? createPortal(header, slot) : header;
}
