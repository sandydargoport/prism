'use client';

/**
 * The editor's controls (#1151): Screen | Dashboard | Widgets | Through the
 * day | Look | More, the same on the built-in Today and on a family's own
 * dashboards; only what is inside Widgets differs. Screen comes first (#1326):
 * the screen being edited, its name, the dashboard it shows and its switches.
 *
 * Every device edits on a canvas (#1265, #1280), so they are a panel in a
 * column beside it (below it on a phone): Cancel and Done at its top right,
 * then the sheets as tabs over the open one, so a panel never covers the
 * dashboard being arranged. One is always open. The bar over the full screen,
 * with sheets rising from it, went with editing in place (#1283).
 */
import * as React from 'react';
import { LayoutDashboard, Monitor, MoreHorizontal, Palette, Shapes, SunMoon, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EditorSheet = 'screen' | 'dashboard' | 'widgets' | 'day' | 'look' | 'more';

const SHEETS: Array<{ id: EditorSheet; label: string; Icon: LucideIcon }> = [
  { id: 'screen', label: 'Screen', Icon: Monitor },
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'widgets', label: 'Widgets', Icon: Shapes },
  { id: 'day', label: 'Through the day', Icon: SunMoon },
  { id: 'look', label: 'Look', Icon: Palette },
  { id: 'more', label: 'More', Icon: MoreHorizontal },
];

export interface EditorBarProps {
  open: EditorSheet | null;
  onOpenChange: (sheet: EditorSheet) => void;
  /** The open sheet's contents. */
  sheet?: React.ReactNode;
  /** Sheets with changes not yet saved get a dot. */
  dirty?: Partial<Record<EditorSheet, boolean>>;
  doneLabel?: string;
  /** Why Done cannot save right now, or null. */
  doneBlocked?: string | null;
  onDone: () => void;
  onCancel: () => void;
  /** Showing the screen as it rests or at night (the Idle screen), not as it is in use; null in use. */
  resting?: 'resting' | 'night' | null;
  /** Showing another dashboard as it is saved, by its name (#1294). */
  previewName?: string | null;
  onLeaveResting?: () => void;
}

export const EditorBar = React.forwardRef<HTMLDivElement, EditorBarProps>(function EditorBar(
  { open, onOpenChange, sheet, dirty = {}, doneLabel = 'Done', doneBlocked = null, onDone, onCancel, resting = null, previewName = null, onLeaveResting },
  ref,
) {
  const title = SHEETS.find((s) => s.id === open)?.label;
  // Where the six tabs do not fit on one line (a 1024px laptop's panel, a
  // phone under 390px) the row scrolls sideways; the open one is kept in view.
  const navRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const nav = navRef.current;
    const tab = nav?.querySelector<HTMLElement>(`[data-editor-open="${open}"]`);
    if (!nav || !tab) return;
    if (tab.offsetLeft < nav.scrollLeft) nav.scrollLeft = tab.offsetLeft;
    else if (tab.offsetLeft + tab.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = tab.offsetLeft + tab.offsetWidth - nav.clientWidth;
  }, [open]);
  // A panel on a light page, as a desktop app has it: Cancel and Done at the
  // top right, and the six sheets as tabs along the top of the panel they
  // open, so nothing dark sits beside the picture. With a mouse a tab is one
  // line of words; a finger keeps 44px or more and the icons.
  return (
    <div ref={ref} className="flex flex-col gap-3 lg:h-full lg:min-h-0" data-editor-bar data-editor-panels>
      <div className="flex min-h-[44px] shrink-0 items-center justify-end gap-2" data-editor-actions>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-full px-4 text-body text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-fine:min-h-8 pointer-fine:px-3 pointer-fine:text-caption pointer-fine:font-medium"
          data-editor-cancel
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={!!doneBlocked}
          title={doneBlocked ?? undefined}
          className="min-h-[44px] rounded-full bg-foreground px-6 text-body font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8 pointer-fine:px-4 pointer-fine:text-caption"
          data-editor-done
        >
          {doneLabel}
        </button>
      </div>
      {/* Through the day has its own, beside its slider (#1294). */}
      {(resting || previewName) && open !== 'day' && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-muted py-1.5 pl-4 pr-1.5 text-body" data-editor-resting={resting ?? 'preview'}>
          {resting === 'night' ? 'Showing the screen at night' : resting ? 'Showing the screen while it rests' : `Showing ${previewName} as it is saved`}
          <button type="button" onClick={onLeaveResting} className="min-h-[44px] rounded-full bg-background px-4 hover:bg-background/70 pointer-fine:min-h-8 pointer-fine:px-3 pointer-fine:text-caption pointer-fine:font-medium">Back to in use</button>
        </div>
      )}
      <div className="flex flex-col rounded-[1.4rem] bg-card text-card-foreground ring-1 ring-border pointer-fine:rounded-2xl lg:min-h-0 lg:flex-1">
        <nav ref={navRef} aria-label="Edit" className="flex shrink-0 overflow-x-auto border-b border-border px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-editor-tabs>
          {SHEETS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpenChange(id)}
              aria-pressed={open === id}
              className={cn(
                // Six tabs (#1326): each as wide as its one-line label, the room
                // left shared out, and a narrow gap: one line each at a phone's
                // 390px and a laptop's panel; narrower, the row scrolls.
                'relative flex min-h-[56px] flex-auto flex-col items-center justify-center gap-1 whitespace-nowrap border-b-2 px-0.5 text-center text-caption font-medium leading-tight transition-colors',
                'pointer-fine:min-h-10 pointer-fine:px-1.5',
                open === id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              data-editor-open={id}
            >
              <Icon className="h-5 w-5 pointer-fine:hidden" aria-hidden />
              <span>{label}</span>
              {dirty[id] && <span aria-label="unsaved changes" className="absolute right-1 top-2 h-1.5 w-1.5 rounded-full bg-primary pointer-fine:right-0 pointer-fine:top-1" />}
            </button>
          ))}
        </nav>
        {open && sheet && (
          // The tab above names the sheet, so it has no heading of its own.
          <section aria-label={title} className="p-5 pointer-fine:p-4 lg:min-h-0 lg:flex-1 lg:overflow-auto" data-editor-sheet={open}>
            {sheet}
          </section>
        )}
      </div>
    </div>
  );
});
