'use client';

import * as React from 'react';
import {
  Settings2,
  Calendar,
  UtensilsCrossed,
  ListChecks,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { OverlayFlags } from '@/lib/hooks/useDayBucketsForRange';

interface ViewOptionsMenuProps {
  // Display group
  displayMode: 'inline' | 'cards';
  onDisplayModeChange: (mode: 'inline' | 'cards') => void;
  weeksBordered: boolean;
  onWeeksBorderedChange: (value: boolean) => void;
  hideWeekends: boolean;
  onHideWeekendsChange: (value: boolean) => void;
  showNotes: boolean;
  onShowNotesChange: (value: boolean) => void;
  /** Whether the current view supports "hide weekends" (week / multi-week / month). */
  weekendsApplicable: boolean;
  /** Whether the current view supports note columns (day / week-vertical). */
  notesApplicable: boolean;
  /** Whether display mode toggle is meaningful (everything except 3-month). */
  displayApplicable: boolean;

  // Optional: Merge calendars toggle (only meaningful in day / list views).
  // When `mergeApplicable` is false the row is hidden.
  mergedView?: boolean;
  onMergedViewChange?: (value: boolean) => void;
  mergeApplicable?: boolean;

  // Overlay group
  overlays: OverlayFlags;
  onOverlaysChange: (next: OverlayFlags) => void;
  /** When false, overlay rows other than Events are explained but disabled. */
  showOverlayRows: boolean;

  /** Reset every option back to default. */
  onReset: () => void;

  /** Override the trigger button height (e.g. "h-8" for compact widget
      toolbars). Defaults to h-9 to match page-level toolbar baseline. */
  triggerClassName?: string;
}

const OVERLAY_ROWS: Array<{ key: keyof OverlayFlags; label: string; Icon: typeof Calendar }> = [
  { key: 'events', label: 'Events', Icon: Calendar },
  { key: 'meals', label: 'Meals', Icon: UtensilsCrossed },
  { key: 'chores', label: 'Chores', Icon: ListChecks },
  { key: 'tasks', label: 'Tasks', Icon: CheckSquare },
];

interface CheckRowProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  Icon?: typeof Calendar;
  disabled?: boolean;
}

function CheckRow({ checked, onChange, label, Icon, disabled }: CheckRowProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
        !disabled && 'hover:bg-accent hover:text-accent-foreground',
        'transition-colors',
        disabled && 'opacity-50 cursor-not-allowed',
        checked ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border',
          checked ? 'bg-primary border-primary' : 'border-muted-foreground/40',
        )}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-primary-foreground stroke-[2.5]">
            <path d="M2 6.5l2.5 2.5L10 3" />
          </svg>
        )}
      </span>
      {Icon && <Icon className="h-4 w-4" />}
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

export function ViewOptionsMenu({
  displayMode,
  onDisplayModeChange,
  weeksBordered,
  onWeeksBorderedChange,
  hideWeekends,
  onHideWeekendsChange,
  showNotes,
  onShowNotesChange,
  weekendsApplicable,
  notesApplicable,
  displayApplicable,
  mergedView = false,
  onMergedViewChange,
  mergeApplicable = false,
  overlays,
  onOverlaysChange,
  showOverlayRows,
  onReset,
  triggerClassName,
}: ViewOptionsMenuProps) {
  // Count toggles that are non-default so we can show a badge on the trigger.
  // 'inline' is the first-load default in both useCalendarViewData and
  // useCalendarWidgetPrefs — keep this in sync with those initializers and
  // with the Reset-to-defaults handlers in CalendarView and CalendarWidgetControls.
  const nonDefaultCount =
    (displayMode === 'inline' ? 0 : 1) +
    (weeksBordered ? 1 : 0) +
    (hideWeekends ? 1 : 0) +
    (showNotes ? 1 : 0) +
    (mergedView ? 1 : 0) +
    (overlays.events ? 0 : 1) +
    (overlays.meals ? 0 : 1) +
    (overlays.chores ? 0 : 1) +
    (overlays.tasks ? 0 : 1);

  const toggleOverlay = (key: keyof OverlayFlags) => {
    onOverlaysChange({ ...overlays, [key]: !overlays[key] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="View options"
          title="View options"
          className={cn('gap-1.5 h-9', triggerClassName)}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">View</span>
          {nonDefaultCount > 0 && (
            // Count circle is the ONLY visual indicator that filters are
            // active — the button's outer fill stays the same regardless,
            // so it sits uniformly alongside the View popover + Today
            // button in the toolbar.
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {nonDefaultCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="space-y-3">
          <section>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Display
            </p>
            <div className="space-y-0.5">
              {displayApplicable && (
                <>
                  <button
                    type="button"
                    onClick={() => onDisplayModeChange('cards')}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      displayMode === 'cards' ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full border',
                        displayMode === 'cards' ? 'border-primary' : 'border-muted-foreground/40',
                      )}
                    >
                      {displayMode === 'cards' && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="flex-1 text-left">Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisplayModeChange('inline')}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      displayMode === 'inline' ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full border',
                        displayMode === 'inline' ? 'border-primary' : 'border-muted-foreground/40',
                      )}
                    >
                      {displayMode === 'inline' && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="flex-1 text-left">Inline blocks</span>
                  </button>
                </>
              )}
              <CheckRow
                checked={weeksBordered}
                onChange={onWeeksBorderedChange}
                label="Grid lines"
              />
              {weekendsApplicable && (
                <CheckRow
                  checked={hideWeekends}
                  onChange={onHideWeekendsChange}
                  label="Hide weekends"
                />
              )}
              {notesApplicable && (
                <CheckRow
                  checked={showNotes}
                  onChange={onShowNotesChange}
                  label="Notes column"
                />
              )}
              {mergeApplicable && onMergedViewChange && (
                <CheckRow
                  checked={mergedView}
                  onChange={onMergedViewChange}
                  label="Merge calendars"
                />
              )}
            </div>
          </section>

          <section>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Show on calendar
            </p>
            <div className="space-y-0.5">
              {OVERLAY_ROWS.map(({ key, label, Icon }) => (
                <CheckRow
                  key={key}
                  checked={overlays[key]}
                  onChange={() => toggleOverlay(key)}
                  label={label}
                  Icon={Icon}
                  disabled={!showOverlayRows && key !== 'events'}
                />
              ))}
            </div>
            {!showOverlayRows && (
              <p className="mt-2 px-2 text-[10px] leading-snug text-muted-foreground">
                Switch to Cards mode to show meals, chores, and tasks alongside events.
              </p>
            )}
          </section>

          {nonDefaultCount > 0 && (
            <>
              <div className="border-t border-border" />
              <button
                type="button"
                onClick={onReset}
                className="flex w-full items-center justify-center rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Reset to defaults
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
