'use client';

/**
 * The editing bar (#1151). Editing starts from the dock at the foot of the
 * screen, so the controls stay there: the dock's place, its dark material and
 * its size, with sheets that rise from it. Nothing is drawn at the top, so a
 * parent never has to look for where the controls went.
 *
 * Done | Dashboard | Widgets | Through the day | Look | More, the same on the
 * built-in Today and on a family's own dashboards; only what is inside the
 * Widgets sheet differs.
 */
import * as React from 'react';
import { Check, LayoutDashboard, MoreHorizontal, Palette, Shapes, SunMoon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EditorSheet = 'dashboard' | 'widgets' | 'day' | 'look' | 'more';

const SHEETS: Array<{ id: EditorSheet; label: string; Icon: typeof Check }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'widgets', label: 'Widgets', Icon: Shapes },
  { id: 'day', label: 'Through the day', Icon: SunMoon },
  { id: 'look', label: 'Look', Icon: Palette },
  { id: 'more', label: 'More', Icon: MoreHorizontal },
];

export interface EditorBarProps {
  open: EditorSheet | null;
  onOpenChange: (sheet: EditorSheet | null) => void;
  /** The open sheet's contents. */
  sheet?: React.ReactNode;
  /** Sheets with changes not yet saved get a dot. */
  dirty?: Partial<Record<EditorSheet, boolean>>;
  doneLabel?: string;
  /** Why Done cannot save right now, or null. */
  doneBlocked?: string | null;
  onDone: () => void;
  onCancel: () => void;
  /** Showing the screen as it rests (the Idle screen), not as it is in use. */
  resting?: boolean;
  onLeaveResting?: () => void;
}

export const EditorBar = React.forwardRef<HTMLDivElement, EditorBarProps>(function EditorBar(
  { open, onOpenChange, sheet, dirty = {}, doneLabel = 'Done', doneBlocked = null, onDone, onCancel, resting = false, onLeaveResting },
  ref,
) {
  const title = SHEETS.find((s) => s.id === open)?.label;
  // On a phone (#1153) the five sheets share one row and their labels may
  // wrap; Cancel and Done sit on a row of their own.
  const item = 'flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-caption font-medium leading-tight transition-colors sm:min-w-[64px] sm:px-3';
  return (
    <div
      ref={ref}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-200 w-[calc(100vw-1rem)] -translate-x-1/2 sm:w-auto"
      data-editor-bar
    >
      {open && sheet && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute bottom-full left-1/2 mb-3 max-h-[min(70vh,44rem)] w-[min(94vw,44rem)] -translate-x-1/2 overflow-auto rounded-[1.4rem] bg-card p-5 text-card-foreground shadow-2xl"
          data-editor-sheet={open}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="m-0 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(null)}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {sheet}
        </div>
      )}
      {resting && !open && (
        <div className="absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-card py-1.5 pl-5 pr-1.5 text-body text-card-foreground shadow-xl" data-editor-resting>
          Showing the screen while it rests
          <button type="button" onClick={onLeaveResting} className="min-h-[44px] rounded-full bg-muted px-4 hover:bg-muted/70">Back to in use</button>
        </div>
      )}
      <nav aria-label="Edit" className="grid grid-cols-5 gap-1 rounded-[20px] bg-[rgb(22_17_13)] p-1.5 shadow-2xl sm:flex sm:items-center">
        {SHEETS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpenChange(open === id ? null : id)}
            aria-expanded={open === id}
            className={cn(item, 'relative text-white/85 hover:bg-white/10', open === id && 'bg-white/15 text-white')}
            data-editor-open={id}
          >
            <Icon className="h-5 w-5" />
            <span className="sm:whitespace-nowrap">{label}</span>
            {dirty[id] && <span aria-label="unsaved changes" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white" />}
          </button>
        ))}
        <span className="mx-1 hidden h-8 w-px bg-white/20 sm:block" aria-hidden />
        <button type="button" onClick={onCancel} className={cn(item, 'col-span-2 text-white/85 hover:bg-white/10')} data-editor-cancel>
          <X className="h-5 w-5" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={!!doneBlocked}
          title={doneBlocked ?? undefined}
          className={cn(item, 'col-span-3 bg-white text-[rgb(22_17_13)] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50')}
          data-editor-done
        >
          <Check className="h-5 w-5" />
          <span>{doneLabel}</span>
        </button>
      </nav>
    </div>
  );
});
